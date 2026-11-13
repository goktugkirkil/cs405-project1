// Rendering layer: owns the WebGPU device, pipelines and per-frame buffers.
// It knows nothing about the scene; main.js hands it matrices and meshes.
//
// Per frame:   r.begin(viewProj) → r.drawMesh / r.drawTextured / r.line ... → r.end()
// Matrices are Float32Array(16), column-major, uploaded as-is.

import { meshWGSL, texturedWGSL, lineWGSL } from './shaders.js';

const OBJ_STRIDE = 256;          // uniform dynamic offsets must be 256-byte aligned
const MAX_OBJECTS = 512;

export async function createRenderer(canvas) {
  if (!navigator.gpu) throw new Error('WebGPU is not available in this browser. Use a current Chrome, Edge, Safari or Firefox.');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter found (see webgpureport.org).');
  const device = await adapter.requestDevice();
  device.lost.then(info => console.error('WebGPU device lost:', info.message));

  // ---- canvas: render through an -srgb view so linear shader output is encoded correctly
  const ctx = canvas.getContext('webgpu');
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();      // bgra8unorm or rgba8unorm
  const viewFormat = `${canvasFormat}-srgb`;
  ctx.configure({ device, format: canvasFormat, viewFormats: [viewFormat], alphaMode: 'opaque' });

  // ---- bind group layouts
  const camLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
  ] });
  const objLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 80 } },
  ] });
  const texLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
  ] });

  const depthFormat = 'depth24plus';
  const depthOn  = { format: depthFormat, depthWriteEnabled: true,  depthCompare: 'less' };
  const depthOff = { format: depthFormat, depthWriteEnabled: false, depthCompare: 'always' };

  function pipeline(code, layouts, buffers, { topology = 'triangle-list', cull = 'none', depth = depthOn } = {}) {
    const module = device.createShaderModule({ code });
    return device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: layouts }),
      vertex: { module, entryPoint: 'vs', buffers },
      fragment: { module, entryPoint: 'fs', targets: [{ format: viewFormat }] },
      primitive: { topology, cullMode: cull },
      depthStencil: depth,
    });
  }

  const posNormal = [{ arrayStride: 24, attributes: [
    { shaderLocation: 0, offset: 0,  format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' } ] }];
  const posUV = [{ arrayStride: 20, attributes: [
    { shaderLocation: 0, offset: 0,  format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x2' } ] }];
  const posColour = [{ arrayStride: 24, attributes: [
    { shaderLocation: 0, offset: 0,  format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' } ] }];

  const meshPipe     = pipeline(meshWGSL,     [camLayout, objLayout],            posNormal, { cull: 'back' });
  const meshPipe2    = pipeline(meshWGSL,     [camLayout, objLayout],            posNormal);   // double-sided (open surfaces)
  const texPipe      = pipeline(texturedWGSL, [camLayout, objLayout, texLayout], posUV);
  const linePipe     = pipeline(lineWGSL,     [camLayout], posColour, { topology: 'line-list' });
  const overlayPipe  = pipeline(lineWGSL,     [camLayout], posColour, { topology: 'line-list', depth: depthOff });

  // ---- uniform buffers
  const camBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const camBind = device.createBindGroup({ layout: camLayout, entries: [{ binding: 0, resource: { buffer: camBuf } }] });

  const objBuf = device.createBuffer({ size: OBJ_STRIDE * MAX_OBJECTS, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const objBind = device.createBindGroup({ layout: objLayout,
    entries: [{ binding: 0, resource: { buffer: objBuf, size: 80 } }] });
  const objCPU = new Float32Array(OBJ_STRIDE * MAX_OBJECTS / 4);

  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

  // ---- line buffers (rebuilt every frame from CPU arrays)
  let lineBuf = null, lineCap = 0;
  function ensureLineBuf(bytes) {
    if (bytes <= lineCap) return;
    lineBuf?.destroy();
    lineCap = Math.max(bytes, lineCap * 2, 64 * 1024);
    lineBuf = device.createBuffer({ size: lineCap, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  }

  // ---- canvas size + depth texture
  let depthTex = null;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const max = device.limits.maxTextureDimension2D;
    const w = Math.max(1, Math.min(max, Math.round(canvas.clientWidth * dpr)));
    const h = Math.max(1, Math.min(max, Math.round(canvas.clientHeight * dpr)));
    if (canvas.width === w && canvas.height === h && depthTex) return;
    canvas.width = w; canvas.height = h;
    depthTex?.destroy();
    depthTex = device.createTexture({ size: [w, h], format: depthFormat, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  }

  // ---- per-frame state
  let enc, pass, objCount, lineData, overlayData, stats;

  const api = {
    device,
    get aspect() { return canvas.width / canvas.height; },
    get width()  { return canvas.width; },
    get height() { return canvas.height; },

    /** Upload vertex data once. kind: 'mesh' (pos+normal) or 'textured' (pos+uv). */
    mesh(data, kind = 'mesh') {
      const buf = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(buf, 0, data);
      return { buf, kind, count: data.length / (kind === 'mesh' ? 6 : 5) };
    },

    /** Load an image as an sRGB texture and return its bind group. */
    async texture(url) {
      const img = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none' });
      const tex = device.createTexture({
        size: [img.width, img.height], format: 'rgba8unorm-srgb',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      device.queue.copyExternalImageToTexture({ source: img, flipY: false }, { texture: tex }, [img.width, img.height]);
      const bind = device.createBindGroup({ layout: texLayout, entries: [
        { binding: 0, resource: sampler }, { binding: 1, resource: tex.createView() } ] });
      return { bind, width: img.width, height: img.height };
    },

    begin(viewProj, clear = { r: 0.012, g: 0.013, b: 0.017, a: 1 }) {
      resize();
      device.queue.writeBuffer(camBuf, 0, viewProj);
      enc = device.createCommandEncoder();
      const view = ctx.getCurrentTexture().createView({ format: viewFormat });
      pass = enc.beginRenderPass({
        colorAttachments: [{ view, clearValue: clear, loadOp: 'clear', storeOp: 'store' }],
        depthStencilAttachment: { view: depthTex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
      });
      pass.setBindGroup(0, camBind);
      objCount = 0; lineData = []; overlayData = [];
      stats = { draws: 0, vertices: 0 };
    },

    /** Change the camera mid-frame is not supported; use one viewProj per frame. */
    _slot(model, colour) {
      if (objCount >= MAX_OBJECTS) throw new Error('too many objects this frame');
      const o = objCount++ * OBJ_STRIDE / 4;
      objCPU.set(model, o);
      objCPU.set(colour, o + 16);
      return objCount - 1;
    },

    /** A mesh whose vertices change every frame (pos+normal). Capacity in vertices. */
    dynamicMesh(maxVertices) {
      const buf = device.createBuffer({ size: maxVertices * 24, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      return { buf, kind: 'mesh', count: 0, max: maxVertices };
    },
    updateMesh(mesh, data) {
      mesh.count = Math.min(mesh.max, data.length / 6);
      device.queue.writeBuffer(mesh.buf, 0, data, 0, mesh.count * 6);
    },

    drawMesh(mesh, model, colour = [0.8, 0.8, 0.8, 1], doubleSided = false) {
      if (!mesh.count) return;
      const s = api._slot(model, colour);
      pass.setPipeline(doubleSided ? meshPipe2 : meshPipe);
      pass.setBindGroup(1, objBind, [s * OBJ_STRIDE]);
      pass.setVertexBuffer(0, mesh.buf);
      pass.draw(mesh.count);
      stats.draws++; stats.vertices += mesh.count;
    },

    drawTextured(mesh, model, texture) {
      const s = api._slot(model, [1, 1, 1, 1]);
      pass.setPipeline(texPipe);
      pass.setBindGroup(1, objBind, [s * OBJ_STRIDE]);
      pass.setBindGroup(2, texture.bind);
      pass.setVertexBuffer(0, mesh.buf);
      pass.draw(mesh.count);
      stats.draws++; stats.vertices += mesh.count;
    },

    /** One world-space line segment. overlay = drawn on top of everything (no depth test). */
    line(a, b, colour = [1, 1, 1], overlay = false) {
      (overlay ? overlayData : lineData).push(a[0], a[1], a[2], ...colour, b[0], b[1], b[2], ...colour);
    },

    /** A connected polyline through an array of [x,y,z] points. */
    polyline(points, colour, overlay = false) {
      for (let i = 0; i + 1 < points.length; i++) api.line(points[i], points[i + 1], colour, overlay);
    },

    end() {
      const n1 = lineData.length / 6, n2 = overlayData.length / 6;
      if (n1 + n2 > 0) {
        ensureLineBuf((lineData.length + overlayData.length) * 4);
        device.queue.writeBuffer(lineBuf, 0, new Float32Array(lineData.concat(overlayData)));
        pass.setVertexBuffer(0, lineBuf);
        if (n1) { pass.setPipeline(linePipe);    pass.draw(n1, 1, 0);  stats.draws++; }
        if (n2) { pass.setPipeline(overlayPipe); pass.draw(n2, 1, n1); stats.draws++; }
        stats.vertices += n1 + n2;
      }
      if (objCount) device.queue.writeBuffer(objBuf, 0, objCPU, 0, objCount * OBJ_STRIDE / 4);
      pass.end();
      device.queue.submit([enc.finish()]);
      return stats;
    },
  };
  resize();
  return api;
}
