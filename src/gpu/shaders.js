// WGSL for the three pipelines. All of them read the same camera uniform (group 0).
// Matrices arrive column-major, which is what WGSL's mat4x4f expects.

const common = /* wgsl */`
struct Camera { viewProj : mat4x4f };
struct Obj    { model : mat4x4f, colour : vec4f };
@group(0) @binding(0) var<uniform> cam : Camera;
`;

// Lit, flat-coloured meshes (cubes etc.).
export const meshWGSL = common + /* wgsl */`
@group(1) @binding(0) var<uniform> obj : Obj;

struct VSOut { @builtin(position) pos : vec4f, @location(0) n : vec3f };

@vertex fn vs(@location(0) p : vec3f, @location(1) n : vec3f) -> VSOut {
  var o : VSOut;
  o.pos = cam.viewProj * obj.model * vec4f(p, 1.0);
  o.n   = (obj.model * vec4f(n, 0.0)).xyz;          // w = 0: a direction
  return o;
}

@fragment fn fs(i : VSOut) -> @location(0) vec4f {
  let L = normalize(vec3f(0.4, 0.8, 0.6));
  let d = max(dot(normalize(i.n), L), 0.0);
  return vec4f(obj.colour.rgb * (0.30 + 0.70 * d), obj.colour.a);
}
`;

// The painting: a textured quad. The texture is rgba8unorm-srgb, so sampling
// returns linear values; the render target is an -srgb view, so they are
// re-encoded on write. Net effect: the painting's colours come out unchanged.
export const texturedWGSL = common + /* wgsl */`
@group(1) @binding(0) var<uniform> obj : Obj;
@group(2) @binding(0) var samp : sampler;
@group(2) @binding(1) var tex  : texture_2d<f32>;

struct VSOut { @builtin(position) pos : vec4f, @location(0) uv : vec2f };

@vertex fn vs(@location(0) p : vec3f, @location(1) uv : vec2f) -> VSOut {
  var o : VSOut;
  o.pos = cam.viewProj * obj.model * vec4f(p, 1.0);
  o.uv  = uv;
  return o;
}

@fragment fn fs(i : VSOut) -> @location(0) vec4f {
  return textureSample(tex, samp, i.uv);
}
`;

// Debug and curve lines, already in world space.
export const lineWGSL = common + /* wgsl */`
struct VSOut { @builtin(position) pos : vec4f, @location(0) c : vec3f };

@vertex fn vs(@location(0) p : vec3f, @location(1) c : vec3f) -> VSOut {
  var o : VSOut;
  o.pos = cam.viewProj * vec4f(p, 1.0);
  o.c   = c;
  return o;
}

@fragment fn fs(i : VSOut) -> @location(0) vec4f { return vec4f(i.c, 1.0); }
`;
