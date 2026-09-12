import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/* ---------------------------------------------------------
   Data: seven components, in physical assembly order,
   top cover (outermost) → strap (bottom-most).
--------------------------------------------------------- */
const PARTS = [
  { id: "topcover",    label: "Top cover",               desc: "3D-printed enclosure — button & status LED" },
  { id: "esp32",       label: "ESP32 DevKit",             desc: "Microcontroller — runs the haptic logic" },
  { id: "breadboard",  label: "Transistors + resistors", desc: "Motor driver — 3× NPN, 1kΩ + 10kΩ" },
  { id: "battery",     label: "Li-Po battery",            desc: "3.7V rechargeable cell" },
  { id: "bottomcover", label: "Bottom cover",             desc: "3D-printed enclosure — seats board & cell" },
  { id: "motors",      label: "Vibration motors",         desc: "3× coin motors, 3 contact points" },
  { id: "strap",       label: "Strap",                    desc: "Flexible TPU band" },
];
const N = PARTS.length;
const LAYER_GAP = 1.05;
const ACCENT = "#F5A623";
const GLOW = 0x2fe0c4;
const GLOW_CSS = "#2FE0C4";

function smoothstep(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/* ---------------------------------------------------------
   Geometry builders — one THREE.Group per part, built once
   at local origin. Simple stylised CAD-teardown primitives.
--------------------------------------------------------- */
function buildPart(type) {
  const g = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.55, metalness: 0.08 });
  const plasticLight = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.5, metalness: 0.08 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.7, metalness: 0.1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b84a, roughness: 0.32, metalness: 0.6 });
  const green = new THREE.MeshStandardMaterial({ color: 0x123322, roughness: 0.55, metalness: 0.1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2e333b, roughness: 0.35, metalness: 0.7 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, emissive: 0xaa6a10, emissiveIntensity: 0.6, roughness: 0.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.85, metalness: 0.02 });
  const chipMat = new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 0.5, metalness: 0.3 });
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xc7a542, roughness: 0.35, metalness: 0.75 });

  if (type === "topcover") {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 1.3), plastic);
    g.add(shell);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 24), plasticLight);
    btn.position.set(1.1, 0.32, 0);
    g.add(btn);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), accentMat);
    led.position.set(-1.15, 0.27, 0.35);
    g.add(led);
    g.userData.shell = shell;
  }

  if (type === "esp32") {
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.1, 1.0), green);
    g.add(pcb);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.6), chipMat);
    chip.position.y = 0.12;
    g.add(chip);
    for (let i = 0; i < 8; i++) {
      const px = -1.25 + i * 0.36;
      const pinA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.09), pinMat);
      pinA.position.set(px, 0.03, 0.52);
      g.add(pinA);
      const pinB = pinA.clone();
      pinB.position.z = -0.52;
      g.add(pinB);
    }
    g.userData.shell = pcb;
  }

  if (type === "breadboard") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 1.1), new THREE.MeshStandardMaterial({ color: 0x121419, roughness: 0.6 }));
    g.add(base);
    for (let c = 0; c < 9; c++) {
      for (let r = 0; r < 3; r++) {
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), dark);
        hole.position.set(-1.2 + c * 0.3, 0.08, -0.32 + r * 0.32);
        g.add(hole);
      }
    }
    [-0.7, 0, 0.7].forEach((tx) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }));
      t.position.set(tx, 0.17, 0.15);
      g.add(t);
    });
    [-1.0, 1.0].forEach((rx) => {
      const bands = [0xd8c08a, 0x7a4a2b, 0x2b2b2b];
      bands.forEach((c, i) => {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
        seg.rotation.z = Math.PI / 2;
        seg.position.set(rx + (i - 1) * 0.13, 0.1, -0.3);
        g.add(seg);
      });
    });
    g.userData.shell = base;
  }

  if (type === "battery") {
    const cell = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.42, 0.9), gold);
    g.add(cell);
    const wireR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xc0392b }));
    wireR.rotation.z = Math.PI / 2;
    wireR.position.set(1.5, 0.06, 0.15);
    g.add(wireR);
    const wireB = wireR.clone();
    wireB.material = new THREE.MeshStandardMaterial({ color: 0x1b1b1b });
    wireB.position.z = -0.15;
    g.add(wireB);
    g.userData.shell = cell;
  }

  if (type === "bottomcover") {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.46, 1.3), plastic);
    g.add(shell);
    [[-1.4, -0.55], [1.4, -0.55], [-1.4, 0.55], [1.4, 0.55]].forEach(([x, z]) => {
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 12), plasticLight);
      peg.position.set(x, 0.3, z);
      g.add(peg);
    });
    g.userData.shell = shell;
  }

  if (type === "motors") {
    [-0.95, 0, 0.95].forEach((mx) => {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.13, 28), metal);
      coin.position.set(mx, 0, 0);
      g.add(coin);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x8a8a8a }));
      wire.position.set(mx, -0.24, 0);
      g.add(wire);
    });
    g.userData.shell = g.children[0];
  }

  if (type === "strap") {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.22, 10, 40, Math.PI * 1.15), rubber);
    torus.rotation.x = Math.PI / 2;
    torus.rotation.z = Math.PI * 0.075;
    torus.scale.y = 0.42;
    g.add(torus);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.05 + (i / 8) * Math.PI * 1.05;
      const hole = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), dark);
      hole.position.set(Math.cos(a) * 1.9, 0.08, Math.sin(a) * 1.9 - 0.1);
      g.add(hole);
    }
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.5, metalness: 0.3 }));
    buckle.position.set(1.9, 0, -0.15);
    g.add(buckle);
    g.userData.shell = torus;
  }

  return g;
}

/* --------------------------------------------------------- */

export default function ExplodedView3D() {
  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const labelRefs = useRef([]);
  const rowRefs = useRef([]);
  const progressFillRef = useRef(null);
  const hintRef = useRef(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 1.6, 11);
    camera.lookAt(0, 0, 0);
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const hemi = new THREE.HemisphereLight(0x8fa2b8, 0x0a0a0c, 0.9);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 6, 5);
    camera.add(key);
    const rim = new THREE.PointLight(GLOW, 0.9, 20);
    rim.position.set(-5, -1, -4);
    scene.add(rim);
    const fill = new THREE.PointLight(0xf5a623, 0.35, 20);
    fill.position.set(-3, 4, 4);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    const partGroups = PARTS.map((part, i) => {
      const holder = new THREE.Group();
      const model = buildPart(part.type || part.id);
      holder.add(model);
      const anchorX = 2.5;
      const anchor = new THREE.Object3D();
      anchor.position.set(anchorX, 0, 0);
      holder.add(anchor);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.9, 0, 0),
        new THREE.Vector3(anchorX - 0.15, 0, 0),
      ]);
      const lineMat = new THREE.LineDashedMaterial({ color: 0xf5a623, dashSize: 0.08, gapSize: 0.07, transparent: true, opacity: 0.55 });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      holder.add(line);

      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), new THREE.MeshBasicMaterial({ color: 0xf5a623 }));
      dot.position.set(0.9, 0, 0);
      holder.add(dot);

      root.add(holder);
      return { holder, anchor, model, index: i };
    });

    let rotY = 0.35;
    let rotX = -0.18;
    let velY = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastInteraction = performance.now();

    const setCursor = (c) => { canvas.style.cursor = c; };
    setCursor("grab");

    function onPointerDown(e) {
      dragging = true;
      velY = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteraction = performance.now();
      setCursor("grabbing");
      canvas.setPointerCapture(e.pointerId);
      if (hintRef.current) hintRef.current.style.opacity = "0";
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      rotY += dx * 0.008;
      rotX = Math.max(-0.55, Math.min(0.65, rotX - dy * 0.006));
      velY = dx * 0.008;
      lastInteraction = performance.now();
    }
    function onPointerUp(e) {
      dragging = false;
      setCursor("grab");
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    function resize() {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let rafId;
    let prevActive = -1;

    function tick() {
      rafId = requestAnimationFrame(tick);

      // scroll progress
      let progress = 1;
      if (!reducedMotion && stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      }

      // idle auto-rotate
      const idleFor = performance.now() - lastInteraction;
      if (!dragging) {
        if (Math.abs(velY) > 0.0002) {
          rotY += velY;
          velY *= 0.94;
        } else if (!reducedMotion && idleFor > 1400) {
          rotY += 0.0028;
        }
      }
      root.rotation.y = rotY;
      root.rotation.x = rotX;

      const activeIdx = Math.min(N - 1, Math.floor(progress * N * 0.999));

      partGroups.forEach(({ holder, anchor, model }, i) => {
        const delay = i * (0.7 / (N - 1));
        const span = 0.3;
        const local = smoothstep((progress - delay) / span);
        const targetY = ((N - 1) / 2 - i) * LAYER_GAP;
        holder.position.y = targetY * local;

        const isActive = i === activeIdx && progress > 0.02;
        if (model.userData.shell) {
          model.userData.shell.material.emissive = model.userData.shell.material.emissive || new THREE.Color(0);
          model.userData.shell.material.emissiveIntensity = isActive ? 0.35 : 0;
          model.userData.shell.material.emissive.set(isActive ? GLOW : 0x000000);
        }

        // project anchor to screen
        const v = new THREE.Vector3();
        anchor.getWorldPosition(v);
        v.project(camera);
        const label = labelRefs.current[i];
        if (label) {
          const behind = v.z > 1;
          const x = (v.x * 0.5 + 0.5) * wrap.clientWidth;
          const y = (1 - (v.y * 0.5 + 0.5)) * wrap.clientHeight;
          label.style.opacity = behind ? "0" : String(0.15 + 0.85 * local);
          label.style.transform = `translate(${x}px, ${y}px) translate(-2px, -50%)`;
          label.style.color = isActive ? "#F4F6F8" : "#B9C0CA";
        }
      });

      if (activeIdx !== prevActive) {
        prevActive = activeIdx;
        setActiveIndex(activeIdx);
      }
      if (progressFillRef.current) {
        progressFillRef.current.style.height = `${progress * 100}%`;
      }

      renderer.render(scene, camera);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
    };
  }, [reducedMotion]);

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        html, body { margin: 0; background: #0B0D10; }
        ::selection { background: ${ACCENT}; color: #0B0D10; }
        .kicker { font-family: 'JetBrains Mono', monospace; letter-spacing: 0.14em; }
        .bounce { animation: bounce 1.8s ease-in-out infinite; }
        @keyframes bounce { 0%,100% { transform: translateY(0);} 50% { transform: translateY(8px);} }
        @keyframes fadein { from { opacity:0; } to { opacity:1; } }
        .hint { animation: fadein .6s ease .3s both; }
        @media (prefers-reduced-motion: reduce) { .bounce { animation: none; } }
        .label-tag { position:absolute; top:0; left:0; white-space:nowrap; pointer-events:none; will-change:transform,opacity; }
        .label-title { font-family:'Space Grotesk',sans-serif; font-size:15px; font-weight:600; }
        .label-desc { font-family:'JetBrains Mono',monospace; font-size:10.5px; color:#6C7480; margin-top:2px; }
        @media (max-width: 860px) {
          .stage-inner { flex-direction: column !important; }
          .stage-list { width: 100% !important; padding: 18px 20px !important; }
          .stage-canvas-wrap { width: 100% !important; height: 56% !important; }
          .label-tag { display:none; }
        }
      `}</style>

      {/* ---------------- HERO ---------------- */}
      <section style={styles.hero}>
        <div style={styles.grid} />
        <p className="kicker" style={styles.kicker}>HW-04 · 360° EXPLODED ASSEMBLY</p>
        <h1 style={styles.h1}>Haptic Wristband</h1>
        <p style={styles.heroSub}>
          Drag the model to spin it, scroll to pull it apart. Seven parts, one
          real-time 3D teardown.
        </p>
        <div className="bounce" style={styles.scrollCue}>
          <span style={styles.scrollCueLine} />
          <span style={styles.scrollCueText}>scroll</span>
        </div>
      </section>

      {/* ---------------- 3D STAGE ---------------- */}
      <section ref={stageRef} style={{ height: `${N * 78 + 90}vh`, position: "relative" }}>
        <div style={styles.sticky}>
          <div className="stage-inner" style={styles.stageInner}>
            <div className="stage-canvas-wrap" style={styles.canvasWrap} ref={wrapRef}>
              <canvas ref={canvasRef} style={styles.canvas} />
              <div ref={hintRef} className="hint" style={styles.dragHint}>
                <span style={styles.dragHintDot} /> drag to rotate
              </div>
              {PARTS.map((part, i) => (
                <div
                  key={part.id}
                  ref={(el) => (labelRefs.current[i] = el)}
                  className="label-tag"
                >
                  <div className="label-title">{part.label}</div>
                  <div className="label-desc">{part.desc}</div>
                </div>
              ))}
            </div>

            <div className="stage-list" style={styles.list}>
              <p className="kicker" style={styles.listKicker}>ASSEMBLY ORDER</p>
              {PARTS.map((part, i) => (
                <div
                  key={part.id}
                  ref={(el) => (rowRefs.current[i] = el)}
                  style={{
                    ...styles.listRow,
                    color: i === activeIndex ? "#F4F6F8" : "#5C6470",
                    opacity: i === activeIndex ? 1 : 0.55,
                  }}
                >
                  <span style={{ ...styles.listDot, background: i === activeIndex ? GLOW_CSS : "#3A404A" }} />
                  <div>
                    <div style={styles.listLabel}>{part.label}</div>
                    <div style={styles.listDesc}>{part.desc}</div>
                  </div>
                </div>
              ))}
              <div style={styles.progressTrack}>
                <div ref={progressFillRef} style={styles.progressFill} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- OUTRO ---------------- */}
      <section style={styles.outro}>
        <p className="kicker" style={styles.kicker}>FULLY EXPLODED</p>
        <h2 style={styles.h2}>Seven parts. One wristband.</h2>
        <div style={styles.chipRow}>
          {PARTS.map((part) => (
            <span key={part.id} style={styles.chip}>{part.label}</span>
          ))}
        </div>
        <p style={styles.outroSub}>ESP32 + vibration motors + transistors — real-time haptic communication.</p>
      </section>
    </div>
  );
}

/* map part id -> geometry type key used by buildPart */
PARTS.forEach((p) => { p.type = p.id; });

/* ---------------------------------------------------------
   Styles
--------------------------------------------------------- */
const styles = {
  page: { background: "#0B0D10", color: "#E8EAED", fontFamily: "'Space Grotesk', sans-serif", width: "100%", minHeight: "100vh" },
  hero: { position: "relative", height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 8vw", overflow: "hidden" },
  grid: {
    position: "absolute", inset: 0,
    backgroundImage: "linear-gradient(#151920 1px, transparent 1px), linear-gradient(90deg, #151920 1px, transparent 1px)",
    backgroundSize: "42px 42px",
    maskImage: "radial-gradient(ellipse at 30% 40%, black 0%, transparent 70%)",
    WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, black 0%, transparent 70%)",
    opacity: 0.7,
  },
  kicker: { color: ACCENT, fontSize: 12.5, margin: "0 0 18px 2px", position: "relative" },
  h1: { fontSize: "clamp(2.6rem, 7vw, 5.4rem)", lineHeight: 1.02, margin: 0, fontWeight: 600, letterSpacing: "-0.02em", position: "relative", maxWidth: 900 },
  heroSub: { marginTop: 22, maxWidth: 480, fontSize: 17, lineHeight: 1.6, color: "#9AA2AD", position: "relative" },
  scrollCue: { position: "absolute", left: "8vw", bottom: 46, display: "flex", alignItems: "center", gap: 10 },
  scrollCueLine: { width: 1, height: 34, background: "#3A404A" },
  scrollCueText: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#6C7480", letterSpacing: "0.1em" },
  sticky: { position: "sticky", top: 0, height: "100vh", display: "flex", alignItems: "stretch", borderTop: "1px solid #14171C" },
  stageInner: { display: "flex", width: "100%", height: "100%" },
  canvasWrap: { width: "58%", height: "100%", position: "relative", touchAction: "none" },
  canvas: { width: "100%", height: "100%", display: "block" },
  dragHint: {
    position: "absolute", left: 24, bottom: 24, display: "flex", alignItems: "center", gap: 8,
    fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#6C7480", letterSpacing: "0.06em",
    pointerEvents: "none",
  },
  dragHintDot: { width: 6, height: 6, borderRadius: "50%", background: ACCENT, display: "inline-block" },
  list: { width: "42%", borderLeft: "1px solid #14171C", padding: "48px 44px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, position: "relative" },
  listKicker: { marginBottom: 8 },
  listRow: { display: "flex", alignItems: "flex-start", gap: 12, transition: "color .25s ease, opacity .25s ease" },
  listDot: { width: 7, height: 7, borderRadius: "50%", marginTop: 7, flexShrink: 0 },
  listLabel: { fontSize: 16, fontWeight: 600 },
  listDesc: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#5C6470", marginTop: 2, lineHeight: 1.5 },
  progressTrack: { position: "absolute", right: 18, top: "12%", bottom: "12%", width: 2, background: "#181B21", borderRadius: 2 },
  progressFill: { width: "100%", height: "0%", background: GLOW_CSS, borderRadius: 2 },
  outro: { padding: "16vh 8vw 18vh", borderTop: "1px solid #14171C", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" },
  h2: { fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, margin: "6px 0 30px" },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 620 },
  chip: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, padding: "8px 14px", borderRadius: 999, border: "1px solid #262B33", color: "#9AA2AD" },
  outroSub: { marginTop: 30, color: "#5C6470", fontSize: 13.5, fontFamily: "'JetBrains Mono', monospace" },
};
