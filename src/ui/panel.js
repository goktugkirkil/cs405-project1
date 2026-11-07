// Minimal control panel (no library). Each control writes straight into a state object.

export function createPanel(root) {
  let section = root;
  const row = (label, el) => {
    const r = document.createElement('label');
    r.className = 'row';
    const s = document.createElement('span'); s.textContent = label;
    r.append(s, el);
    section.append(r);
    return r;
  };

  return {
    section(title, open = true) {
      const d = document.createElement('details');
      d.open = open;
      const s = document.createElement('summary'); s.textContent = title;
      d.append(s);
      root.append(d);
      section = d;
      return d;
    },

    slider(label, obj, key, min, max, step = 0.01, onChange) {
      const el = document.createElement('input');
      Object.assign(el, { type: 'range', min, max, step, value: obj[key] });
      const out = document.createElement('output');
      const show = () => (out.textContent = (+obj[key]).toFixed(step < 1 ? 2 : 0));
      el.addEventListener('input', () => { obj[key] = +el.value; show(); onChange?.(obj[key]); });
      show();
      const r = row(label, el); r.append(out);
      return { el, refresh() { el.value = obj[key]; show(); } };
    },

    checkbox(label, obj, key, onChange) {
      const el = document.createElement('input');
      el.type = 'checkbox'; el.checked = !!obj[key];
      el.addEventListener('change', () => { obj[key] = el.checked; onChange?.(obj[key]); });
      row(label, el);
      return { el, refresh() { el.checked = !!obj[key]; } };
    },

    select(label, obj, key, options, onChange) {
      const el = document.createElement('select');
      for (const [value, text] of Object.entries(options)) el.append(new Option(text, value));
      el.value = obj[key];
      el.addEventListener('change', () => { obj[key] = el.value; onChange?.(obj[key]); });
      row(label, el);
      return { el, refresh() { el.value = obj[key]; } };
    },

    button(label, onClick) {
      const el = document.createElement('button');
      el.textContent = label;
      el.addEventListener('click', onClick);
      section.append(el);
      return el;
    },

    html(className = '') {
      const el = document.createElement('div');
      el.className = className;
      section.append(el);
      return el;
    },
  };
}

/** Format a column-major 4×4 matrix as 4 rows of text. */
export function matrixHTML(m, digits = 2) {
  if (!m) return '<span class="todo">—</span>';
  const rows = [];
  for (let r = 0; r < 4; r++) {
    const cells = [];
    for (let c = 0; c < 4; c++) {
      const v = m[c * 4 + r];
      cells.push((Object.is(v, -0) ? 0 : v).toFixed(digits).padStart(digits + 4));
    }
    rows.push(`[${cells.join(' ')} ]`);
  }
  return `<pre>${rows.join('\n')}</pre>`;
}
