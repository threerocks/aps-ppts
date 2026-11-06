/* 翻页、分步显示、数字滚动、总览与配色切换、画笔；放映同步（演讲者视图与观众窗口）与嵌入 */
(() => {
  const root = document.documentElement;
  // 观众只能在同一套模板的配色之间切换：可切换的配色由渲染器写在 data-palettes（[[id, 名称], …]），
  // 演示稿当前的配色在 data-palette，data-palette-switch="off" 时不能切换。
  // 数字键 1–9 各对应一种，所以最多 9 种（0 不用）
  let PALETTES = [];
  try { if (root.dataset.palettes) PALETTES = JSON.parse(root.dataset.palettes).slice(0, 9); } catch (e) {}
  const deckPalette = root.dataset.palette || PALETTES[0]?.[0] || '';
  const canSwitch = root.dataset.paletteSwitch !== 'off' && PALETTES.length > 1;
  const paletteKey = 'deck-palette:' + location.pathname;
  const stage = document.getElementById('stage');
  const slides = [...stage.querySelectorAll('.slide')];
  const total = slides.length;
  const bar = document.querySelector('.progress i');
  const tb = document.querySelector('.toolbar');
  const params = new URLSearchParams(location.search);
  // 嵌入在演讲者视图里：live 是当前页（照常播放动效），still 是下一页预览（直接显示结果）。嵌入时不显示工具条、不改地址
  const embed = params.get('embed');
  // 同一场放映的窗口（演讲者视图、观众窗口）带同一个 sync 值，任一边翻页另一边跟着翻
  const sync = params.get('sync');
  let cur = 0;
  // 当前页已经出现的分步组数
  let step = 0;
  let started = false;

  // 工具条文字跟随演示稿的内容语言（观众看到的是演示稿，不是 APS 界面）
  const L = /^zh-(TW|HK|Hant)/i.test(root.lang)
    ? {
      overview: '總覽 O', fullscreen: '全螢幕 F', exit: '結束放映 P', hint: n => `← → 翻頁${n ? ` · 1–${n} 切配色` : ''} · F 全螢幕 · D 畫筆`, enter: '點一下進入全螢幕',
      pen: '畫筆 D', penTools: '畫筆', undo: '復原 Z', clear: '清除本頁 E', colors: ['紅色', '藍色', '綠色'],
    }
    : /^zh/i.test(root.lang)
      ? {
        overview: '总览 O', fullscreen: '全屏 F', exit: '退出放映 P', hint: n => `← → 翻页${n ? ` · 1–${n} 切配色` : ''} · F 全屏 · D 画笔`, enter: '点一下进入全屏',
        pen: '画笔 D', penTools: '画笔', undo: '撤销 Z', clear: '清除本页 E', colors: ['红色', '蓝色', '绿色'],
      }
      : {
        overview: 'Overview O', fullscreen: 'Full screen F', exit: 'End show P', hint: n => `← → slides${n ? ` · 1–${n} colors` : ''} · F full screen · D pen`, enter: 'Click to go full screen',
        pen: 'Pen D', penTools: 'Pen', undo: 'Undo Z', clear: 'Clear slide E', colors: ['Red', 'Blue', 'Green'],
      };

  // 嵌在演讲者视图里时，这一页只是那个页面的一部分，不再标成页面的主体区域
  if (embed) { document.body.classList.add('embed'); stage.removeAttribute('role'); }
  if (embed === 'still') document.body.classList.add('still');

  // 入场顺序：页脚、页码、章节进度格已由渲染器生成
  slides.forEach(s => s.querySelectorAll('.a, .st > *, .hd > *').forEach((el, i) => el.style.setProperty('--i', i)));

  // 数字从 0 滚到目标值；元素里原本的文字就是最终值。系统设了「减少动态效果」时直接显示最终值
  const countUp = s => {
    if (embed === 'still' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    s.querySelectorAll('[data-count]').forEach(el => {
      const raw = el.dataset.count;
      const target = parseFloat(raw);
      const dec = (raw.split('.')[1] || '').length;
      const fmt = v => 'sep' in el.dataset
        ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
        : v.toFixed(dec);
      const t0 = performance.now() + 300, dur = 1300;
      cancelAnimationFrame(el._raf);
      const tick = now => {
        const p = Math.max(0, Math.min(1, (now - t0) / dur));
        el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) el._raf = requestAnimationFrame(tick);
      };
      el.textContent = fmt(0);
      el._raf = requestAnimationFrame(tick);
    });
  };

  // ---------- 分步与隐藏页 ----------

  // 分步组：同一个 data-step 的 .frag 一起出现，没写 data-step 的各自一组。
  // 页面带 data-step-order（空格分隔的 step 值）时按它的顺序出现，没列出的排在后面、按页面里的顺序；
  // 带 data-nosteps 的页面不分步，整页一次出现（优先于 data-step-order）
  const nosteps = s => s.hasAttribute('data-nosteps');
  const groupsOf = s => {
    if (nosteps(s)) return [];
    const map = new Map();
    s.querySelectorAll('.frag').forEach((f, i) => {
      const k = f.dataset.step ?? 'i' + i;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(f);
    });
    const keys = [...map.keys()];
    const order = (s.dataset.stepOrder || '').split(/\s+/).filter(Boolean);
    if (order.length) {
      const rank = k => (order.includes(k) ? order.indexOf(k) : order.length);
      keys.sort((a, b) => rank(a) - rank(b));
    }
    return keys.map(k => map.get(k));
  };
  const groups = slides.map(groupsOf);
  // 导出 PDF、图片时按同样的顺序展开分步：第 k 页的每个 .frag（按页面里的顺序）属于第几组，-1 表示不分步、一直显示
  window.apsPlayer = {
    steps: k => groups[k].length,
    groupOf: k => [...slides[k].querySelectorAll('.frag')].map(f => groups[k].findIndex(g => g.includes(f))),
  };
  // 隐藏页放映时跳过；直接指定从它开始（地址里的页码）时照常显示
  const listed = slides.map((s, k) => k).filter(k => !slides[k].hasAttribute('data-hidden'));
  const after = k => listed.find(j => j > k) ?? -1;
  const before = k => [...listed].reverse().find(j => j < k) ?? -1;

  const setStep = n => {
    const gs = groups[cur];
    step = Math.max(0, Math.min(gs.length, n));
    if (nosteps(slides[cur])) slides[cur].querySelectorAll('.frag').forEach(f => f.classList.add('on'));
    else gs.forEach((g, j) => g.forEach(f => f.classList.toggle('on', j < step)));
  };
  // 再按一次「下一步」会到哪里：演讲者视图的下一页预览用
  const upcoming = () => {
    if (step < groups[cur].length) return { index: cur, step: step + 1 };
    const j = after(cur);
    return j < 0 ? null : { index: j, step: 0 };
  };

  // ---------- 同步 ----------

  const channel = sync && 'BroadcastChannel' in window ? new BroadcastChannel('aps-show:' + sync) : null;
  const state = () => ({ type: 'aps:state', index: cur, step, steps: groups[cur].length, total, palette: root.dataset.palette, next: upcoming() });
  // 自己翻页（local）时告诉同一场放映的其它窗口；收到别人的位置只跟着翻，不再转发，免得来回。
  // 被嵌入时每次都回报给外层页面
  const announce = local => {
    const s = state();
    if (local && channel) channel.postMessage(s);
    if (parent !== window) {
      try { parent.postMessage(s, location.origin === 'null' ? '*' : location.origin); } catch (e) {}
    }
  };

  // ---------- 翻页 ----------

  // 画笔（见下面「画笔」一节）；嵌入时没有
  let pen = null;

  // s：显示到第几个分步组，true 表示全部
  const show = (n, s = 0, local = true) => {
    const k = Math.max(0, Math.min(total - 1, n));
    const moved = k !== cur || !started;
    cur = k;
    started = true;
    slides.forEach((el, j) => {
      el.classList.toggle('active', j === cur);
      el.classList.toggle('past', j < cur);
    });
    setStep(s === true ? Infinity : s);
    if (moved) countUp(slides[cur]);
    const seen = listed.filter(j => j <= cur).length;
    bar.style.width = (listed.length ? Math.max(seen, 1) / listed.length : (cur + 1) / total) * 100 + '%';
    if (!embed) history.replaceState(null, '', location.pathname + location.search + '#' + (cur + 1));
    pen?.sync();
    announce(local);
  };
  const next = () => {
    if (step < groups[cur].length) return show(cur, step + 1);
    const j = after(cur);
    if (j >= 0) show(j, 0);
  };
  const prev = () => {
    if (step > 0) return show(cur, step - 1);
    const j = before(cur);
    if (j >= 0) show(j, true);
  };
  const first = () => show(listed[0] ?? 0, 0);
  const last = () => show(listed.at(-1) ?? total - 1, true);

  const fit = () => {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  };
  const isOverview = () => document.body.classList.contains('overview');
  const overview = on => {
    if (on) pen?.set(false);
    document.body.classList.toggle('overview', on);
    tb.querySelector('[data-ov]').setAttribute('aria-pressed', on);
    if (on) slides[cur].scrollIntoView({ block: 'center' });
    else fit();
  };

  // remember：只记住观众自己点选的配色（按演示稿分开记），打开时不覆盖演示稿保存的配色；嵌入时不记。
  // local：自己发起的切换才告诉同一场放映的其它窗口
  const setPalette = (p, { remember = false, local = true } = {}) => {
    root.dataset.palette = p;
    tb.querySelectorAll('[data-p]').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === p));
    if (remember && !embed) try { localStorage.setItem(paletteKey, p); } catch (e) {}
    if (started) announce(local);
  };

  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.())?.catch?.(() => {});
  const unfullscreen = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };

  // 退出放映（P 或工具条按钮）：回到进入放映之前的地方。
  //   嵌在编辑器里：交给编辑器（退出全屏，停在放到的这一页）；
  //   观众窗口：通知同一场的演讲者视图结束放映（它会回到编辑器），自己关掉；
  //   由别的页面用脚本打开：告诉它放到了哪一页，然后关掉自己；
  //   地址带 ?back=（本站路径）：回到那里，带上页码 #page=；
  //   都不是（分享链接、离线包）：只退出全屏
  const back = /^\/(?!\/)/.test(params.get('back') || '') ? params.get('back') : null;
  const origin = location.origin === 'null' ? '*' : location.origin;
  const canLeave = () => parent !== window || !!channel || !!(window.opener && !window.opener.closed) || !!back;
  const leave = () => {
    const msg = { type: 'aps:exit', index: cur };
    if (parent !== window) {
      try { parent.postMessage(msg, origin); } catch (e) {}
      return;
    }
    if (channel) channel.postMessage(msg);
    if (window.opener && !window.opener.closed) {
      try { window.opener.postMessage(msg, origin); } catch (e) {}
    }
    if (channel || window.opener) {
      window.close();
      if (window.closed) return;
    }
    if (back) location.href = back.replace(/#.*$/, '') + '#page=' + (cur + 1);
    else unfullscreen();
  };

  // 工具条
  const hint = tb.querySelector('.hint');
  hint.textContent = L.hint(canSwitch ? PALETTES.length : 0);
  if (canSwitch) {
    PALETTES.forEach(([p, name], k) => {
      const b = document.createElement('button');
      b.dataset.p = p;
      b.textContent = `${k + 1} ${name}`;
      b.onclick = e => { e.stopPropagation(); setPalette(p, { remember: true }); };
      tb.insertBefore(b, hint);
    });
    const sep = document.createElement('span');
    sep.className = 'sep';
    tb.insertBefore(sep, hint);
  }
  const ov = document.createElement('button');
  ov.dataset.ov = '';
  ov.textContent = L.overview;
  ov.onclick = e => { e.stopPropagation(); overview(!isOverview()); };
  tb.insertBefore(ov, hint);
  const fs = document.createElement('button');
  fs.textContent = L.fullscreen;
  fs.onclick = e => { e.stopPropagation(); fullscreen(); };
  tb.insertBefore(fs, hint);
  const ex = document.createElement('button');
  ex.textContent = L.exit;
  ex.onclick = e => { e.stopPropagation(); leave(); };
  tb.insertBefore(ex, hint);
  // 没有地方可回、也不在全屏时，「退出放映」什么也做不了，就不显示
  // 工具条按钮用了 all: unset，hidden 属性不起作用，直接改 display
  const showExit = () => { ex.style.display = canLeave() || document.fullscreenElement ? '' : 'none'; };
  showExit();
  document.addEventListener('fullscreenchange', showExit);

  const has = p => canSwitch && PALETTES.some(x => x[0] === p);
  let saved = null;
  try { saved = embed ? null : localStorage.getItem(paletteKey); } catch (e) {}
  // 地址里的 ?palette=；旧链接带的 ?theme=（以前观众能换模板）不再理会，按演示稿的配色打开
  const q = params.get('palette');
  // 不允许观众切换时总用演示稿的配色；否则：地址里指定的 > 观众选过的 > 演示稿保存的（渲染器写在 <html data-palette>）
  setPalette(has(q) ? q : has(saved) ? saved : deckPalette, { local: false });
  show((parseInt(location.hash.slice(1), 10) || 1) - 1, 0, false);
  fit();
  addEventListener('resize', () => { if (!isOverview()) fit(); });

  // 嵌入时由外层页面控制：
  //   { type: 'aps:go', index, step | reveal } 翻到某页的某一步；{ type: 'aps:next' | 'aps:prev' | 'aps:first' | 'aps:last' }；
  //   { type: 'aps:palette', palette } 换配色。每次变化后回报 { type: 'aps:state', index, step, steps, total, palette, next }
  addEventListener('message', e => {
    if (parent === window || e.source !== parent) return;
    const d = e.data || {};
    if (d.type === 'aps:go') show(d.index, d.reveal ? true : d.step ?? 0);
    if (d.type === 'aps:next') next();
    if (d.type === 'aps:prev') prev();
    if (d.type === 'aps:first') first();
    if (d.type === 'aps:last') last();
    if (d.type === 'aps:palette' && has(d.palette)) setPalette(d.palette);
  });
  if (channel) {
    channel.onmessage = e => {
      const d = e.data || {};
      if (d.type === 'aps:state') {
        if (has(d.palette) && d.palette !== root.dataset.palette) setPalette(d.palette, { local: false });
        if (d.index !== cur || d.step !== step) show(d.index, d.step, false);
      }
      // 新打开的窗口先问一声现在放到哪了，已经在放的窗口回报位置
      if (d.type === 'aps:hello') channel.postMessage(state());
      // 另一边结束了放映：嵌在演讲者视图里就交给它，观众窗口关掉自己（关不掉就退出全屏）
      if (d.type === 'aps:exit') {
        if (parent !== window) {
          try { parent.postMessage(d, origin); } catch (e) {}
        } else {
          window.close();
          if (!window.closed) unfullscreen();
        }
      }
    };
    channel.postMessage({ type: 'aps:hello' });
  }
  addEventListener('hashchange', () => {
    const n = (parseInt(location.hash.slice(1), 10) || 1) - 1;
    if (n !== cur) show(n);
  });

  // 嵌入的预览只受外层页面控制
  if (embed) return;

  // 观众窗口：浏览器只允许用户点击之后进入全屏，所以先给一个按钮；按任意键或已经全屏就收起
  if (sync && !document.fullscreenElement) {
    const enter = document.createElement('button');
    enter.className = 'fs-prompt';
    enter.textContent = L.enter;
    enter.onclick = e => { e.stopPropagation(); enter.remove(); fullscreen(); };
    document.body.append(enter);
    addEventListener('keydown', () => enter.remove(), { once: true });
    document.addEventListener('fullscreenchange', () => enter.remove(), { once: true });
  }

  // ---------- 画笔 ----------
  // 打开画笔（D 或右下角的按钮）后点击、拖动都是在页面上画，不翻页；键盘照常翻页。
  // 笔迹按页记在内存里：换页时收起，翻回来还在；不存进演示稿，刷新就没了。Esc、D 或再点按钮退出
  pen = (() => {
    const W = 1920, H = 1080, WIDTH = 6;
    const COLORS = ['#ff3b30', '#2f7cf6', '#22b35e'];
    // 页序号 → 笔画 [{ color, width, points: [[x, y], …] }]，坐标是 1920×1080 的页面坐标
    const strokes = new Map();
    let on = false, color = COLORS[0], active = null, canvas = null, ctx = null;

    const tools = document.createElement('div');
    tools.className = 'pen-tools';
    // 和工具条一样是带名称的区域，读屏软件能直接跳到
    tools.setAttribute('role', 'region');
    tools.setAttribute('aria-label', L.penTools);
    const opts = document.createElement('div');
    opts.className = 'pen-opts';
    opts.hidden = true;
    const button = (text, onclick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.onclick = e => { e.stopPropagation(); onclick(); };
      return b;
    };
    const swatches = COLORS.map((c, i) => {
      const b = button('', () => { color = c; swatches.forEach(x => x.setAttribute('aria-pressed', x === b)); });
      b.className = 'pen-color';
      b.style.setProperty('--c', c);
      b.setAttribute('aria-label', L.colors[i]);
      b.title = L.colors[i];
      b.setAttribute('aria-pressed', c === color);
      return b;
    });
    const undo = button(L.undo, () => { finish(); strokes.get(cur)?.pop(); redraw(); });
    undo.setAttribute('aria-keyshortcuts', 'Z');
    const clear = button(L.clear, () => { finish(); strokes.delete(cur); redraw(); });
    clear.setAttribute('aria-keyshortcuts', 'E');
    opts.append(...swatches, undo, clear);
    const toggle = button(L.pen, () => set(!on));
    toggle.className = 'pen-toggle';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-keyshortcuts', 'D');
    tools.append(opts, toggle);
    document.body.append(tools);

    const refresh = () => { undo.disabled = clear.disabled = !strokes.get(cur)?.length; };
    const paint = (s, from = 0) => {
      const p = s.points;
      ctx.strokeStyle = ctx.fillStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath();
      if (p.length === 1) {
        ctx.arc(p[0][0], p[0][1], s.width / 2, 0, Math.PI * 2);
        return ctx.fill();
      }
      const i0 = Math.max(1, from);
      ctx.moveTo(p[i0 - 1][0], p[i0 - 1][1]);
      for (let i = i0; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.stroke();
    };
    const redraw = () => {
      if (ctx) {
        ctx.clearRect(0, 0, W, H);
        (strokes.get(cur) || []).forEach(s => paint(s));
      }
      refresh();
    };
    const finish = () => {
      if (!active) return;
      const id = active.id;
      active = null;
      if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
      refresh();
    };
    // 画布盖在整页上，跟着舞台一起缩放；按屏幕像素比（最多 2 倍）放大分辨率，笔迹不发虚
    const build = () => {
      canvas = document.createElement('canvas');
      canvas.className = 'pen-layer';
      canvas.setAttribute('aria-hidden', 'true');
      const k = Math.min(2, Math.max(1, devicePixelRatio || 1));
      canvas.width = W * k;
      canvas.height = H * k;
      ctx = canvas.getContext('2d');
      ctx.setTransform(k, 0, 0, k, 0, 0);
      stage.append(canvas);
      let box = null;
      const point = e => [(e.clientX - box.left) * W / box.width, (e.clientY - box.top) * H / box.height];
      canvas.addEventListener('pointerdown', e => {
        if (!on || !e.isPrimary || e.button !== 0) return;
        e.preventDefault();
        finish();
        box = canvas.getBoundingClientRect();
        // 页面缩得很小时（手机）笔画至少有 3 个屏幕像素宽
        const s = { color, width: Math.max(WIDTH, 3 * W / box.width), points: [point(e)] };
        if (!strokes.has(cur)) strokes.set(cur, []);
        strokes.get(cur).push(s);
        active = { id: e.pointerId, s };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        paint(s);
        refresh();
      });
      canvas.addEventListener('pointermove', e => {
        if (!active || active.id !== e.pointerId) return;
        const p = active.s.points;
        const from = p.length;
        const samples = e.getCoalescedEvents?.() || [];
        (samples.length ? samples : [e]).forEach(x => p.push(point(x)));
        paint(active.s, from);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => canvas.addEventListener(t, e => { if (active?.id === e.pointerId) finish(); }));
      redraw();
    };
    const set = v => {
      finish();
      on = !!v && !isOverview();
      if (on && !canvas) build();
      document.body.classList.toggle('pen', on);
      toggle.setAttribute('aria-pressed', on);
      opts.hidden = !on;
      refresh();
    };
    addEventListener('blur', finish);
    // 键盘：D 开关；画笔打开时 Esc 退出、Z（或 Ctrl / ⌘ Z）撤销一笔、E 清除本页。处理了返回 true
    const key = e => {
      const k = e.key, plain = !e.metaKey && !e.ctrlKey && !e.altKey;
      if (plain && (k === 'd' || k === 'D')) { if (!isOverview()) set(!on); return true; }
      if (!on) return false;
      if (k === 'Escape') { set(false); return true; }
      if ((k === 'z' || k === 'Z') && !e.altKey && !e.shiftKey) { e.preventDefault(); undo.click(); return true; }
      if (plain && (k === 'e' || k === 'E')) { clear.click(); return true; }
      return false;
    };
    return { set, key, isOn: () => on, sync: () => { finish(); redraw(); } };
  })();

  addEventListener('keydown', e => {
    // 焦点在按钮上时空格、回车是按按钮，不翻页
    if ((e.key === ' ' || e.key === 'Enter') && e.target.closest?.('button')) return;
    if (pen.key(e)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'o' || k === 'O') return overview(!isOverview());
    if (k === 'p' || k === 'P') return leave();
    if (k === 'Escape') return overview(false);
    if (canSwitch && /^[1-9]$/.test(k) && PALETTES[k - 1]) return setPalette(PALETTES[k - 1][0], { remember: true });
    if (canSwitch && (k === 't' || k === 'T')) {
      const i = PALETTES.findIndex(x => x[0] === root.dataset.palette);
      return setPalette(PALETTES[(i + 1) % PALETTES.length][0], { remember: true });
    }
    if (isOverview()) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') first();
    else if (k === 'End') last();
    else if (k === 'f' || k === 'F') fullscreen();
  });

  stage.addEventListener('click', e => {
    if (pen.isOn()) return;
    if (isOverview()) {
      const s = e.target.closest('.slide');
      if (s) { show(slides.indexOf(s), true); overview(false); }
      return;
    }
    if (getSelection().toString()) return;
    e.clientX < innerWidth * 0.3 ? prev() : next();
  });

  let x0 = null;
  addEventListener('touchstart', e => { x0 = pen.isOn() || e.target.closest?.('.pen-tools') ? null : e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', e => {
    if (x0 === null || isOverview() || pen.isOn()) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
    x0 = null;
  });

  let idle;
  const wake = () => {
    document.body.classList.remove('idle');
    clearTimeout(idle);
    idle = setTimeout(() => document.body.classList.add('idle'), 2500);
  };
  addEventListener('mousemove', wake);
  wake();
})();
