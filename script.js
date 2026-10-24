import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const RED = 0xd1242c;

/* ---------- Roată 3D ---------- */
function buildWheel() {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);

  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.38, 32, 96),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 })
  );
  tire.scale.z = 0.8;
  spin.add(tire);

  const metal = new THREE.MeshStandardMaterial({ color: 0xdfe1e6, metalness: 1, roughness: 0.2, side: THREE.DoubleSide });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.55, 48, 1, true), metal);
  barrel.rotation.x = Math.PI / 2;
  spin.add(barrel);

  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.04, 16, 64), metal);
  lip.position.z = 0.27;
  spin.add(lip);

  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI * 2) / 5;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.07), metal);
    spoke.position.set(0, 0.4, 0.2);
    arm.add(spoke);
    spin.add(arm);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 32), metal);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.22;
  spin.add(hub);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.05, 32),
    new THREE.MeshStandardMaterial({ color: RED, roughness: 0.4 })
  );
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.3;
  spin.add(cap);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.05, 48),
    new THREE.MeshStandardMaterial({ color: 0x6a6d73, metalness: 0.9, roughness: 0.45 })
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.z = -0.08;
  spin.add(disc);

  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.36, 0.2),
    new THREE.MeshStandardMaterial({ color: RED, roughness: 0.35, metalness: 0.2 })
  );
  caliper.position.set(0.5, 0.15, -0.08);
  caliper.rotation.z = -0.35;
  group.add(caliper);

  return { group, spin };
}

/* ---------- Scenă reutilizabilă ---------- */
function createStage(canvas, camPos, onFrame) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(3, 4, 5);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(...camPos);
  camera.lookAt(0, 0, 0);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    onFrame(clock.getDelta(), clock.elapsedTime);
    renderer.render(scene, camera);
  })();
  return { scene, camera, renderer };
}

/* ---------- Hero: mașina 3D  ---------- */
const heroCanvas = document.getElementById("heroCanvas");
if (heroCanvas) {
  let controls;
  const { scene, camera, renderer } = createStage(heroCanvas, [4.2, 1.2, 5.2], () => controls && controls.update());

  controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.08,
    autoRotate: !reduced, autoRotateSpeed: 2.2,
    minPolarAngle: Math.PI / 3, maxPolarAngle: Math.PI / 2.05
  });
  renderer.domElement.style.touchAction = "pan-y"; 

  let resume;
  controls.addEventListener("start", () => { controls.autoRotate = false; clearTimeout(resume); });
  controls.addEventListener("end", () => { if (!reduced) resume = setTimeout(() => (controls.autoRotate = true), 2500); });

  new GLTFLoader().load("./models/pixar_cars_series_lightning_mcqueen.glb", (gltf) => {
    const car = gltf.scene;
    const box = new THREE.Box3().setFromObject(car);
    const size = box.getSize(new THREE.Vector3());
    car.position.sub(box.getCenter(new THREE.Vector3()));
    const holder = new THREE.Group(); // mașina stă singură, fără cerc în spate
    holder.scale.setScalar(4.9 / Math.max(size.x, size.y, size.z));
    holder.add(car);
    scene.add(holder);

    // Doar pe mobil: pornește din profil (mașina văzută din lateral), apoi se rotește de aici
    if (matchMedia("(max-width: 960px)").matches) {
      const SIDE = 1;            // pune -1 dacă vrei mașina văzută din partea opusă (cu fața în stânga)
      const dist = 6.7, height = 1.2;
      const alongX = size.x >= size.z; // axa pe care e lungă mașina; camera se pune perpendicular
      camera.position.set(alongX ? 0 : dist * SIDE, height, alongX ? dist * SIDE : 0);
      controls.update();
    }
    document.getElementById("heroLoading")?.remove();
  }, undefined, (err) => {
    console.error("Eroare la încărcarea mașinii 3D:", err);
    const el = document.getElementById("heroLoading");
    if (el) el.textContent = "Mașina nu s-a putut încărca";
  });
}

/* ---------- Geometrie roți 3D: cursoare pentru cădere și convergență ---------- */
const geoCanvas = document.getElementById("geoCanvas");
if (geoCanvas) {
  const camber = document.getElementById("camber");
  const toe = document.getElementById("toe");
  const status = document.getElementById("geoStatus");
  const fmt = (v) => Number(v).toFixed(1).replace(".", ",") + "°";
  const EXAGGERATE = 3; // unghiurile reale sunt mici, le mărim ca să se vadă

  const wheel = buildWheel();
  wheel.group.rotation.y = Math.PI / 2; // axa roții pe direcția X
  const pivot = new THREE.Group();
  pivot.add(wheel.group);

  const ghost = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.012, 8, 120),
    new THREE.MeshBasicMaterial({ color: 0xff3b44 })
  );
  ghost.rotation.y = Math.PI / 2;
  const ground = new THREE.GridHelper(7, 14, 0xd1242c, 0x4a4143);
  ground.position.y = -1.38;

  const { scene } = createStage(geoCanvas, [4.2, 1.6, 5], (dt) => {
    wheel.spin.rotation.z -= reduced ? 0 : dt * 0.5;
    pivot.rotation.z += (THREE.MathUtils.degToRad(-camber.value * EXAGGERATE) - pivot.rotation.z) * 0.15;
    pivot.rotation.y += (THREE.MathUtils.degToRad(toe.value * EXAGGERATE) - pivot.rotation.y) * 0.15;
  });
  scene.add(pivot, ghost, ground);

  const update = () => {
    const c = +camber.value, t = +toe.value;
    document.getElementById("camberV").textContent = fmt(c);
    document.getElementById("toeV").textContent = fmt(t);
    if (Math.abs(c) < 0.3 && Math.abs(t) < 0.3) {
      status.textContent = "În linie cu conturul roșu: anvelopa se uzează uniform și mașina merge drept.";
    } else if (Math.abs(t) >= Math.abs(c)) {
      status.textContent = "Roata e întoarsă față de direcția de mers: anvelopa se freacă lateral și mașina poate trage într-o parte.";
    } else {
      status.textContent = "Roata e înclinată: anvelopa se uzează mai mult pe o margine, nu pe toată suprafața.";
    }
  };
  camber.addEventListener("input", update);
  toe.addEventListener("input", update);
  update();

  document.getElementById("geoFix").addEventListener("click", () => {
    const c0 = +camber.value, t0 = +toe.value, start = performance.now();
    (function step(now) {
      const k = Math.min((now - start) / 900, 1), e = 1 - Math.pow(1 - k, 3);
      camber.value = c0 * (1 - e);
      toe.value = t0 * (1 - e);
      update();
      if (k < 1) requestAnimationFrame(step);
    })(start);
  });
}

/* ---------- Hartă interactivă: tip hartă, zoom, copiere adresă ---------- */
const frame = document.getElementById("mapFrame");
if (frame) {
  const ADDR = "Strada Alexandru Ioan Cuza 2, Jitaru, 235605, Olt, Romania";
  const map = { t: "m", z: 16 };
  const render = () => (frame.src = `https://www.google.com/maps?q=${encodeURIComponent(ADDR)}&z=${map.z}&t=${map.t}&output=embed`);
  document.querySelectorAll("[data-t]").forEach((b) =>
    b.addEventListener("click", () => {
      map.t = b.dataset.t;
      document.querySelectorAll("[data-t]").forEach((x) => x.classList.toggle("is-on", x === b));
      render();
    })
  );
  document.querySelectorAll("[data-z]").forEach((b) =>
    b.addEventListener("click", () => {
      map.z = Math.max(5, Math.min(20, map.z + Number(b.dataset.z)));
      render();
    })
  );
  const copy = document.getElementById("copyAddr");
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText("Str. Alexandru Ioan Cuza, Nr. 2, Sat Jitaru, Oraș Scornicești, Jud. Olt, 235605"); copy.textContent = "Copiat ✓"; }
    catch { copy.textContent = "Nu am putut copia"; }
    setTimeout(() => (copy.textContent = "Copiază adresa"), 2000);
  });
}

/* ---------- Servicii: carusel de poze (mobil) ---------- */
const gallery = document.querySelector(".squares");
if (gallery) {
  const slides = [...gallery.children];
  const dots = document.createElement("div");
  dots.className = "carousel-dots";
  const btns = slides.map((slide, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", `Poza ${i + 1} din ${slides.length}`);
    b.addEventListener("click", () => gallery.scrollTo({ left: slide.offsetLeft - gallery.offsetLeft, behavior: "smooth" }));
    dots.appendChild(b);
    return b;
  });
  gallery.after(dots);
  const mark = () => {
    const atEnd = gallery.scrollLeft + gallery.clientWidth >= gallery.scrollWidth - 4;
    let cur = slides.length - 1;
    if (!atEnd) cur = slides.reduce((best, s, i) => Math.abs(s.offsetLeft - gallery.offsetLeft - gallery.scrollLeft) < Math.abs(slides[best].offsetLeft - gallery.offsetLeft - gallery.scrollLeft) ? i : best, 0);
    btns.forEach((b, i) => b.classList.toggle("is-on", i === cur));
  };
  gallery.addEventListener("scroll", mark, { passive: true });
  addEventListener("resize", mark);
  mark();
}

/* ---------- Efect 3D la mouse pe carduri ---------- */
if (matchMedia("(hover: hover)").matches && !reduced) {
  document.querySelectorAll(".tilt").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 12 + "deg");
      el.style.setProperty("--rx", (0.5 - (e.clientY - r.top) / r.height) * 12 + "deg");
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  });
}

/* ---------- Meniu, header, apariții, date ---------- */
const burger = document.getElementById("burger");
const menu = document.getElementById("menu");
const toggleMenu = (open) => { menu.classList.toggle("is-open", open); burger.setAttribute("aria-expanded", String(open)); };
burger.addEventListener("click", () => toggleMenu(!menu.classList.contains("is-open")));
menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));

const header = document.querySelector(".site-header");
const onScroll = () => header.classList.toggle("is-scrolled", scrollY > 10);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
}), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

const year = new Date().getFullYear();
document.getElementById("years").textContent = year - 2019;
document.getElementById("yr").textContent = year;
