let globalState = {
    driverScore: 100,
    parts: {
        brakes: { health: 100, events: 0, temperature: 38 },
        tires: { health: 100, events: 0, pressure: 32 },
        engine: { health: 100, events: 0, rpm: 800 },
        suspension: { health: 100, events: 0, load: 0.1 },
        pedal: { health: 100, events: 0, position: 0 }
    },
    sessionKm: 0
};

let selectedPart = null;

function colorFor(h) {
    if (h > 70) return '#10b981';
    if (h > 30) return '#f59e0b';
    return '#ef4444';
}

function colorForGradient(h) {
    if (h > 70) return 'var(--healthy-grad)';
    if (h > 30) return 'var(--warning-grad)';
    return 'var(--critical-grad)';
}

function hexFor(h) {
    if (h > 70) return 0x10b981;
    if (h > 30) return 0xf59e0b;
    return 0xef4444;
}

function updateUI(data) {
    document.getElementById('session-km').innerText = `Sesi: ${data.sessionKm} km`;

    const P = data.parts;

    function setTag(key, pct, sub) {
        document.getElementById(`hud-${key}-val`).innerText = `${pct.toFixed(0)}%`;
        document.getElementById(`hud-${key}-val`).style.color = colorFor(pct);
        document.getElementById(`hud-${key}-sub`).innerText = sub;
        document.getElementById(`dot-${key}`).style.background = colorFor(pct);
        document.getElementById(`dot-${key}`).style.boxShadow = `0 0 6px ${colorFor(pct)}`;
    }

    setTag('engine', P.engine.health, `${P.engine.rpm.toLocaleString('id-ID')} RPM`);
    setTag('brakes', P.brakes.health, `${P.brakes.temperature.toFixed(0)}°C · ${P.brakes.events} Kejadian`);
    setTag('tires', P.tires.health, `${P.tires.pressure.toFixed(1)} PSI · ${P.tires.events} Kejadian`);
    setTag('suspension', P.suspension.health, `${P.suspension.events} Dampak Terdeteksi`);
    setTag('pedal', P.pedal.health, `${P.pedal.position}% Posisi`);

    document.getElementById('speedo-num').innerText = 0;
    document.getElementById('rpm-display').innerText = `${P.engine.rpm.toLocaleString('id-ID')} RPM`;
}

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = false;
controls.maxPolarAngle = Math.PI / 2.05;
controls.enabled = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(4, 8, 5);
sun.castShadow = true;
sun.shadow.bias = -0.001;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0xdde8ff, 0.3);
fillLight.position.set(-4, 3, -4);
scene.add(fillLight);

const grid = new THREE.GridHelper(14, 14, 0xe2e8f0, 0xf1f5f9);
grid.position.y = -0.22;
scene.add(grid);

const TUBE_R = 0.022;
const TUBE_SEG = 24;
const TUBE_LEN = 18;

const pipeMat = new THREE.MeshPhysicalMaterial({
    color: 0xbac4d0,
    metalness: 0.8,
    roughness: 0.25,
    clearcoat: 0.4,
    clearcoatRoughness: 0.15
});

const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.03,
    roughness: 0.05,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false
});

const edgeMat = new THREE.LineBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.15
});

const highlightPipeMat = new THREE.MeshPhysicalMaterial({
    color: 0x2563eb,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.1
});

function makeTube(points, radius = TUBE_R, mat = pipeMat) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, TUBE_LEN, radius, TUBE_SEG, false);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.castShadow = true;
    return mesh;
}

function makeRod(from, to, r = 0.018, mat = pipeMat) {
    const pts = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
    return makeTube(pts, r, mat);
}

function makeGhostBox(geo, pos, rot = [0, 0, 0]) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geo, shellMat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    group.add(mesh);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
    edge.position.set(...pos);
    edge.rotation.set(...rot);
    group.add(edge);
    return group;
}

const chassisGroup = new THREE.Group();
scene.add(chassisGroup);

[-0.75, 0.75].forEach(x => {
    chassisGroup.add(makeTube([
        new THREE.Vector3(x, 0, 1.8),
        new THREE.Vector3(x, 0, 1.2),
        new THREE.Vector3(x, -0.05, 0.6),
        new THREE.Vector3(x, -0.05, -0.6),
        new THREE.Vector3(x, 0, -1.2),
        new THREE.Vector3(x, 0, -1.8)
    ]));

    chassisGroup.add(makeTube([
        new THREE.Vector3(x, 0.55, 0.95),
        new THREE.Vector3(x, 0.65, 0.4),
        new THREE.Vector3(x, 0.65, -0.4),
        new THREE.Vector3(x, 0.55, -0.95)
    ], TUBE_R * 0.8));
});

chassisGroup.add(makeRod([-0.75, 0, 1.8], [0.75, 0, 1.8], 0.024));
chassisGroup.add(makeRod([-0.75, 0, 1.3], [0.75, 0, 1.3], 0.020));
chassisGroup.add(makeRod([-0.75, -0.05, 0.6], [0.75, -0.05, 0.6], 0.020));
chassisGroup.add(makeRod([-0.75, -0.05, 0.0], [0.75, -0.05, 0.0], 0.020));
chassisGroup.add(makeRod([-0.75, -0.05, -0.6], [0.75, -0.05, -0.6], 0.020));
chassisGroup.add(makeRod([-0.75, 0, -1.3], [0.75, 0, -1.3], 0.024));
chassisGroup.add(makeRod([-0.75, 0, -1.8], [0.75, 0, -1.8], 0.024));

const frontBumperPts = [];
const rearBumperPts = [];
for (let i = 0; i <= 8; i++) {
    const theta = (i / 8) * Math.PI * 0.4 - Math.PI * 0.2;
    frontBumperPts.push(new THREE.Vector3(Math.sin(theta) * 1.5, 0.05, 1.95 + Math.cos(theta) * 0.08 - 0.08));
    rearBumperPts.push(new THREE.Vector3(Math.sin(theta) * 1.5, 0.05, -1.95 - Math.cos(theta) * 0.08 + 0.08));
}
chassisGroup.add(makeTube(frontBumperPts, TUBE_R * 0.9));
chassisGroup.add(makeTube(rearBumperPts, TUBE_R * 0.9));

function makeWheelArch(x, z, r = 0.38) {
    const curvePoints = [];
    const segments = 12;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI;
        curvePoints.push(new THREE.Vector3(x, Math.sin(theta) * r - 0.06, z + Math.cos(theta) * r));
    }
    return makeTube(curvePoints, TUBE_R * 0.65);
}
[-0.78, 0.78].forEach(x => {
    [1.1, -1.1].forEach(z => {
        chassisGroup.add(makeWheelArch(x, z));
    });
});

chassisGroup.add(makeTube([
    new THREE.Vector3(0, 0.05, 1.6),
    new THREE.Vector3(0, -0.1, 0.8),
    new THREE.Vector3(0, -0.15, 0.0),
    new THREE.Vector3(0, -0.1, -0.8),
    new THREE.Vector3(0, 0.05, -1.6)
], TUBE_R * 0.85, highlightPipeMat));

[-0.72, 0.72].forEach(x => {
    chassisGroup.add(makeTube([
        new THREE.Vector3(x, 0, 0.98),
        new THREE.Vector3(x, 0.28, 0.92),
        new THREE.Vector3(x, 0.55, 0.95)
    ], TUBE_R * 0.8));
});

[-0.72, 0.72].forEach(x => {
    chassisGroup.add(makeRod([x, 0, 0.05], [x, 0.65, 0.1], TUBE_R * 0.8));
});

[-0.72, 0.72].forEach(x => {
    chassisGroup.add(makeTube([
        new THREE.Vector3(x, 0, -0.95),
        new THREE.Vector3(x, 0.3, -1.0),
        new THREE.Vector3(x, 0.55, -0.95)
    ], TUBE_R * 0.85));
});

[-0.7, 0.7].forEach(x => {
    chassisGroup.add(makeTube([
        new THREE.Vector3(x, 0.65, 0.95),
        new THREE.Vector3(x, 0.72, 0.3),
        new THREE.Vector3(x, 0.72, -0.3),
        new THREE.Vector3(x, 0.65, -0.95)
    ], TUBE_R * 0.65));
});

chassisGroup.add(makeRod([-0.7, 0.72, 0.3], [0.7, 0.72, 0.3], 0.016));
chassisGroup.add(makeRod([-0.7, 0.72, -0.3], [0.7, 0.72, -0.3], 0.016));

[-0.7, 0.7].forEach(x => {
    chassisGroup.add(makeRod([x, 0, 1.3], [x, 0.35, 1.3], TUBE_R));
    chassisGroup.add(makeRod([x, 0.35, 1.3], [0, 0.05, 1.55], TUBE_R * 0.7));
    chassisGroup.add(makeRod([x, 0.35, 1.3], [x * 0.4, 0.05, 1.4], TUBE_R * 0.7));
});

chassisGroup.add(makeRod([-0.7, 0.35, 1.3], [0.7, 0.35, 1.3], 0.016, highlightPipeMat));

[-0.7, 0.7].forEach(x => {
    chassisGroup.add(makeRod([x, 0, -1.3], [x, 0.3, -1.3], TUBE_R));
    chassisGroup.add(makeRod([x, 0.3, -1.3], [0, 0.05, -1.55], TUBE_R * 0.7));
});

const fwGeo = new THREE.BoxGeometry(1.5, 0.65, 0.04);
chassisGroup.add(makeGhostBox(fwGeo, [0, 0.18, 1.28]));

const floorGeo = new THREE.BoxGeometry(1.42, 0.08, 3.4);
chassisGroup.add(makeGhostBox(floorGeo, [0, -0.08, 0]));

const cabinGeo = new THREE.BoxGeometry(1.38, 0.6, 1.85);
chassisGroup.add(makeGhostBox(cabinGeo, [0, 0.38, -0.05]));

const hoodGeo = new THREE.BoxGeometry(1.4, 0.12, 0.9);
chassisGroup.add(makeGhostBox(hoodGeo, [0, 0.12, 1.35], [0.12, 0, 0]));

[-0.12, 0.12].forEach(x => {
    chassisGroup.add(makeTube([
        new THREE.Vector3(x, -0.16, 1.2),
        new THREE.Vector3(x, -0.18, 0.0),
        new THREE.Vector3(x, -0.16, -1.2)
    ], 0.010, new THREE.MeshPhysicalMaterial({ color: 0xaab4be, metalness: .5, roughness: .6 })));
});

const exhaustMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.15,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1
});

[-0.22, 0.22].forEach(x => {
    const pipePoints = [
        new THREE.Vector3(x, 0.1, 1.1),
        new THREE.Vector3(x, -0.16, 0.9),
        new THREE.Vector3(x, -0.18, 0.0),
        new THREE.Vector3(x, -0.16, -0.8),
        new THREE.Vector3(x * 1.8, -0.14, -1.2),
        new THREE.Vector3(x * 2.0, -0.06, -1.6)
    ];
    chassisGroup.add(makeTube(pipePoints, 0.016, exhaustMat));
});

const mufflerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.32, 16);
[-0.42, 0.42].forEach(x => {
    const muffler = new THREE.Mesh(mufflerGeo, exhaustMat);
    muffler.position.set(x, -0.06, -1.6);
    muffler.rotation.x = Math.PI / 2;
    muffler.castShadow = true;
    scene.add(muffler);

    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.12, 12), exhaustMat);
    tip.position.set(x, -0.06, -1.82);
    tip.rotation.x = Math.PI / 2;
    scene.add(tip);
});

const partsMeshes = { engine: [], brakes: [], tires: [], suspension: [], pedal: [] };

function makePart(geo, pos, color = 0x10b981) {
    const mat = new THREE.MeshPhysicalMaterial({
        color, metalness: 0.55, roughness: 0.35, transparent: true, opacity: 0.88,
        emissive: color, emissiveIntensity: 0.06
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
}

const engBlk = makePart(new THREE.BoxGeometry(0.38, 0.22, 0.55), [0, 0.08, 1.1]);
const engAlt = makePart(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 16), [-0.22, 0.22, 0.95]);

const engHeadL = makePart(new THREE.BoxGeometry(0.18, 0.16, 0.52), [-0.13, 0.22, 1.1]);
engHeadL.rotation.z = Math.PI / 6;
const engHeadR = makePart(new THREE.BoxGeometry(0.18, 0.16, 0.52), [0.13, 0.22, 1.1]);
engHeadR.rotation.z = -Math.PI / 6;

const radCasing = makePart(new THREE.BoxGeometry(0.68, 0.44, 0.06), [0, 0.15, 1.7]);
const radHoseU = makePart(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.25, 1.1),
    new THREE.Vector3(0, 0.32, 1.4),
    new THREE.Vector3(0, 0.28, 1.68)
]), 8, 0.016, 8, false), [0, 0, 0]);

const gearbox = makePart(new THREE.CylinderGeometry(0.16, 0.10, 0.45, 16), [0, -0.04, 0.72]);
gearbox.rotation.x = Math.PI / 2;

partsMeshes.engine.push(engBlk, engAlt, engHeadL, engHeadR, radCasing, radHoseU, gearbox);

const steelMat = new THREE.MeshPhysicalMaterial({ color: 0xd1d5db, metalness: 0.95, roughness: 0.1 });
const driveshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 12), steelMat);
driveshaft.position.set(0, -0.05, -0.15);
driveshaft.rotation.x = Math.PI / 2;
scene.add(driveshaft);

const diffCasing = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), steelMat);
diffCasing.position.set(0, -0.05, -1.1);
scene.add(diffCasing);

const axleL = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.65, 12), steelMat);
axleL.position.set(-0.35, -0.05, -1.1);
axleL.rotation.z = Math.PI / 2;
scene.add(axleL);

const axleR = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.65, 12), steelMat);
axleR.position.set(0.35, -0.05, -1.1);
axleR.rotation.z = Math.PI / 2;
scene.add(axleR);

partsMeshes.suspension.push(axleL, axleR);

const wheelPos = [
    [-0.82, 0, 1.1], [0.82, 0, 1.1],
    [-0.82, 0, -1.1], [0.82, 0, -1.1]
];

const steeringBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 12), steelMat);
steeringBar.position.set(0, -0.08, 1.25);
steeringBar.rotation.z = Math.PI / 2;
scene.add(steeringBar);

const tieRodL = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.32, 8), steelMat);
tieRodL.position.set(-0.55, -0.08, 1.22);
tieRodL.rotation.z = Math.PI / 2.3;
scene.add(tieRodL);

const tieRodR = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.32, 8), steelMat);
tieRodR.position.set(0.55, -0.08, 1.22);
tieRodR.rotation.z = -Math.PI / 2.3;
scene.add(tieRodR);

partsMeshes.suspension.push(steeringBar, tieRodL, tieRodR);

wheelPos.forEach(pos => {
    const wx = pos[0];
    const wy = pos[1];
    const wz = pos[2];

    const hx = wx * 0.84;
    const cx = wx * 0.62;

    const armU1 = makeRod([hx, wy + 0.12, wz], [cx, wy + 0.12, wz + 0.14], 0.012);
    const armU2 = makeRod([hx, wy + 0.12, wz], [cx, wy + 0.12, wz - 0.14], 0.012);
    partsMeshes.suspension.push(armU1, armU2);

    const armL1 = makeRod([hx, wy - 0.10, wz], [cx, wy - 0.10, wz + 0.18], 0.014);
    const armL2 = makeRod([hx, wy - 0.10, wz], [cx, wy - 0.10, wz - 0.18], 0.014);
    partsMeshes.suspension.push(armL1, armL2);

    const tire = makePart(new THREE.CylinderGeometry(0.30, 0.30, 0.20, 32), pos, 0x10b981);
    tire.rotation.z = Math.PI / 2;
    partsMeshes.tires.push(tire);

    const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.21, 24);
    const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xbdc6d0, metalness: .85, roughness: .2 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(...pos); rim.rotation.z = Math.PI / 2;
    scene.add(rim);

    const brake = makePart(new THREE.BoxGeometry(0.07, 0.14, 0.12), [
        pos[0] * 0.84, pos[1] + 0.06, pos[2]
    ], 0x10b981);
    partsMeshes.brakes.push(brake);

    const disc = makePart(new THREE.CylinderGeometry(0.15, 0.15, 0.025, 24), [
        pos[0] * 0.88, pos[1], pos[2]
    ], 0xaab4be);
    disc.rotation.z = Math.PI / 2;

    const suspGroup = new THREE.Group();
    const ringsX = pos[0] * 0.72;
    const ringsZ = pos[2];
    for (let i = 0; i < 5; i++) {
        const coilGeo = new THREE.TorusGeometry(0.055, 0.013, 10, 22);
        const coilMat = new THREE.MeshPhysicalMaterial({
            color: 0x10b981, metalness: 0.7, roughness: 0.3, transparent: true, opacity: 0.9,
            emissive: 0x10b981, emissiveIntensity: 0.05
        });
        const ring = new THREE.Mesh(coilGeo, coilMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(ringsX, 0.28 - i * 0.08, ringsZ);
        suspGroup.add(ring);
    }
    const damperGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.36, 12);
    const damperMesh = new THREE.Mesh(damperGeo, new THREE.MeshPhysicalMaterial({
        color: 0x9ca3af, metalness: 0.85, roughness: 0.2
    }));
    damperMesh.position.set(ringsX, 0.18, ringsZ);
    suspGroup.add(damperMesh);
    scene.add(suspGroup);
    partsMeshes.suspension.push(suspGroup);
});

const pedalMesh = makePart(new THREE.BoxGeometry(0.08, 0.15, 0.02), [0.35, 0.1, 0.75], 0x10b981);
pedalMesh.rotation.x = -Math.PI / 6;
partsMeshes.pedal.push(pedalMesh);

function update3DModel(data) {
    const P = data.parts;

    function applyColor(meshes, color) {
        meshes.forEach(obj => {
            obj.traverse(child => {
                if (!child.isMesh || !child.material) return;
                if (child.material.color && child.material.emissive) {
                    const hex = hexFor(color);
                    child.material.color.setHex(hex);
                    child.material.emissive.setHex(hex);

                    if (color <= 30) {
                        child.userData.pulsing = true;
                        child.material.emissiveIntensity = 0.45;
                    } else {
                        child.userData.pulsing = false;
                        child.material.emissiveIntensity = 0.06;
                    }
                }
            });
        });
    }

    applyColor(partsMeshes.engine, P.engine.health);
    applyColor(partsMeshes.brakes, P.brakes.health);
    applyColor(partsMeshes.tires, P.tires.health);
    applyColor(partsMeshes.suspension, P.suspension.health);
    applyColor(partsMeshes.pedal, P.pedal.health);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const meshToKey = new Map();
for (const [key, arr] of Object.entries(partsMeshes)) {
    arr.forEach(obj => obj.traverse(c => { if (c.isMesh) meshToKey.set(c, key); }));
}

let hoveredPart = null;

function setHoveredPart(key) {
    if (key !== hoveredPart) {
        hoveredPart = key;
        container.style.cursor = hoveredPart ? 'pointer' : 'default';
        updatePartVisibilities();

        ['engine', 'brakes', 'tires', 'suspension', 'pedal'].forEach(k => {
            const card = document.getElementById(`label-${k}`);
            if (card) {
                card.classList.toggle('active', k === hoveredPart);
            }
        });
    }
}

container.addEventListener('mousemove', e => {
    if (e.target.closest('.hud-tag') || e.target.closest('.detail-drawer') || e.target.closest('.canvas-topbar')) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...meshToKey.keys()]);

    let currentHover = null;
    if (hits.length) {
        currentHover = meshToKey.get(hits[0].object);
    }

    setHoveredPart(currentHover);
});

container.addEventListener('click', e => {
    if (e.target.closest('.hud-tag') || e.target.closest('.detail-drawer') || e.target.closest('.canvas-topbar')) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...meshToKey.keys()]);
    if (hits.length) {
        selectComponent(meshToKey.get(hits[0].object));
    }
});

function updatePartVisibilities() {
    for (const [part, arr] of Object.entries(partsMeshes)) {
        arr.forEach(obj => obj.traverse(c => {
            if (!c.isMesh) return;
            if (selectedPart) {
                c.material.opacity = (part === selectedPart) ? 1.0 : 0.3;
            } else if (hoveredPart) {
                c.material.opacity = (part === hoveredPart) ? 1.0 : 0.55;
            } else {
                c.material.opacity = 0.9;
            }

            if (part === hoveredPart) {
                c.material.emissiveIntensity = 0.35;
            } else if (globalState && globalState.parts[part].health <= 30) {
            } else {
                c.material.emissiveIntensity = 0.06;
            }
        }));
    }
}

const FORMULAS = {
    engine: {
        math: 'ΔH = 14 × (pedal_gas% / 100) × (RPM / 7000)²',
        desc: 'Beban gesekan mekanis piston dan termal meningkat seiring besarnya bukaan throttle dan kenaikan putaran RPM secara kuadratis.',
        vars: [
            { sym: 'ΔH', def: 'Laju keausan internal mesin (%)' },
            { sym: 'pedal_gas%', def: 'Tingkat pembukaan katup gas (0-100%)' },
            { sym: 'RPM', def: 'Putaran poros engkol mesin per menit' },
            { sym: '14', def: 'Konstanta sensitivitas termomekanis mesin' }
        ]
    },
    brakes: {
        math: 'ΔH = 18 × (v / 200)² × deselerasi_g',
        desc: 'Disipasi energi kinetik kendaraan menjadi energi panas pada rem sebanding dengan kuadrat kecepatan dan gaya tekan deselerasi.',
        vars: [
            { sym: 'ΔH', def: 'Laju keausan kampas & piringan rem (%)' },
            { sym: 'v', def: 'Kecepatan kendaraan saat ini (km/h)' },
            { sym: 'deselerasi_g', def: 'Gaya deselerasi pengereman (G)' },
            { sym: '18', def: 'Konstanta gesek termal material rem' }
        ]
    },
    tires: {
        math: 'ΔH = 12 × (|deselerasi_g| + 0.5×lateral_g + 0.3×pedal_gas%) × (v / 200)',
        desc: 'Keausan tapak ban dipengaruhi gaya slip gesek gabungan (rem, belokan lateral, akselerasi) dikalikan kecepatan laju menggelinding.',
        vars: [
            { sym: 'ΔH', def: 'Laju keausan kompon karet ban (%)' },
            { sym: 'deselerasi_g', def: 'Gaya deselerasi longitudinal (G)' },
            { sym: 'lateral_g', def: 'Gaya sentrifugal tikungan lateral (G)' },
            { sym: 'pedal_gas%', def: 'Katup akselerasi pedal gas (%)' },
            { sym: 'v', def: 'Kecepatan kendaraan saat ini (km/h)' },
            { sym: '12', def: 'Konstanta koefisien gesek geser ban' }
        ]
    },
    suspension: {
        math: 'ΔH = 16 × kekasaran_jalan × (1 + v / 60)',
        desc: 'Peredam kejut menerima respon impuls vertikal jalan yang ditentukan oleh indeks kekasaran jalan (IRI) dan diamplifikasi oleh kecepatan kendaraan.',
        vars: [
            { sym: 'ΔH', def: 'Laju keausan peredam kejut sasis (%)' },
            { sym: 'kekasaran_jalan', def: 'Indeks kekasaran permukaan jalan (skala IRI 0-10)' },
            { sym: 'v', def: 'Kecepatan kendaraan saat ini (km/h)' },
            { sym: '16', def: 'Konstanta sensitivitas respon impuls suspensi' }
        ]
    },
    pedal: {
        math: 'ΔH = 5 × (pedal_gas% / 100) × frekuensi_injak',
        desc: 'Keausan sensor dan pegas pedal gas bergantung pada intensitas penekanan dan frekuensi injakan oleh pengemudi.',
        vars: [
            { sym: 'ΔH', def: 'Laju keausan komponen mekanis pedal (%)' },
            { sym: 'pedal_gas%', def: 'Tingkat pembukaan pedal (0-100%)' },
            { sym: 'frekuensi_injak', def: 'Jumlah injakan per menit' },
            { sym: '5', def: 'Konstanta degradasi material pedal' }
        ]
    }
};

const DISPLAY = {
    engine: 'Unit Perakitan Mesin Utama',
    brakes: 'Sistem Kaliper & Cakram Rem',
    tires: 'Sistem Ban & Pengaturan Tekanan',
    suspension: 'Peredam Kejut & Suspensi Sasis',
    pedal: 'Modul Pedal Akselerator'
};

function selectComponent(key) {
    selectedPart = key;
    showDrawer(key);
    updatePartVisibilities();
}

function showDrawer(key) {
    if (!globalState) return;
    const P = globalState.parts;
    const part = P[key];

    document.getElementById('detail-drawer').classList.add('active');
    document.getElementById('drawer-empty').classList.add('hidden');
    document.getElementById('drawer-detail').classList.remove('hidden');

    document.getElementById('drawer-title').innerText = DISPLAY[key];
    document.getElementById('drawer-subtitle').innerText = `Terakhir diperbarui via telemetri lokal`;
    document.getElementById('drawer-pct').innerText = `${part.health.toFixed(1)}%`;
    document.getElementById('drawer-pct').style.color = colorFor(part.health);
    document.getElementById('drawer-bar').style.width = `${part.health}%`;
    document.getElementById('drawer-bar').style.background = colorForGradient(part.health);

    const badge = document.getElementById('drawer-badge');
    badge.className = 'drawer-badge';
    if (part.health > 70) {
        badge.innerText = 'OPTIMAL'; badge.classList.add('badge-ok');
    } else if (part.health > 30) {
        badge.innerText = 'PERINGATAN ⚠'; badge.classList.add('badge-warn');
    } else {
        badge.innerText = 'KRITIS ✕'; badge.classList.add('badge-crit');
    }

    document.getElementById('d-events').innerText = part.events;
    const formulaData = FORMULAS[key];
    document.getElementById('rumus').innerText = formulaData.math;
    document.getElementById('penjelasan').innerText = formulaData.desc;

    const varContainer = document.getElementById('daftar-variabel');
    varContainer.innerHTML = '';
    formulaData.vars.forEach(v => {
        const row = document.createElement('div');
        row.className = 'baris-variabel';

        const sym = document.createElement('span');
        sym.className = 'simbol-variabel';
        sym.innerText = v.sym;

        const def = document.createElement('span');
        def.className = 'deskripsi-variabel';
        def.innerText = v.def;

        row.appendChild(sym);
        row.appendChild(def);
        varContainer.appendChild(row);
    });

    let live = '—';
    if (key === 'engine') live = `${P.engine.rpm.toLocaleString('id-ID')} RPM`;
    if (key === 'brakes') live = `${P.brakes.temperature.toFixed(0)}°C`;
    if (key === 'tires') live = `${P.tires.pressure.toFixed(1)} PSI`;
    if (key === 'suspension') live = `${P.suspension.events} getaran terekam`;
    if (key === 'pedal') live = `${P.pedal.position}% ditekan`;

    document.getElementById('d-live').innerText = live;
    document.getElementById('d-status').innerText = part.health > 70 ? 'Nominal / Beroperasi Baik' : part.health > 30 ? 'Mengalami Degradasi' : 'Kritis — Butuh Servis Segera';
    document.getElementById('d-service').innerText = `${Math.round(45000 * (part.health / 100)).toLocaleString('id-ID')} km sisa pakai`;
}

function closeDrawer() {
    selectedPart = null;
    document.getElementById('detail-drawer').classList.remove('active');
    document.getElementById('drawer-empty').classList.remove('hidden');
    document.getElementById('drawer-detail').classList.add('hidden');
    document.getElementById('drawer-title').innerText = 'Tidak Ada Komponen Terpilih';

    updatePartVisibilities();
}

const ANNO_TARGETS = {
    engine: { mesh: partsMeshes.engine[0], offsetX: -150, offsetY: -90 },
    brakes: { mesh: partsMeshes.brakes[0], offsetX: -150, offsetY: 65 },
    tires: { mesh: partsMeshes.tires[1], offsetX: 120, offsetY: -70 },
    suspension: { mesh: partsMeshes.suspension[19], offsetX: 120, offsetY: 80 },
    pedal: { mesh: partsMeshes.pedal[0], offsetX: 80, offsetY: 40 }
};

const svg = document.getElementById('anno-svg');
const anchorDots = {};
['engine', 'brakes', 'tires', 'suspension', 'pedal'].forEach(key => {
    const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circ.setAttribute('r', '4');
    circ.style.fill = 'var(--primary)';
    circ.style.transition = 'fill 0.3s, opacity 0.3s';
    svg.appendChild(circ);
    anchorDots[key] = circ;
});

function updateHUDLines() {
    const rect = container.getBoundingClientRect();

    for (const [key, cfg] of Object.entries(ANNO_TARGETS)) {
        const mesh = cfg.mesh;
        if (!mesh) continue;

        const worldPos = new THREE.Vector3();
        if (mesh.isGroup) {
            let count = 0;
            mesh.traverse(c => {
                if (c.isMesh) { worldPos.add(c.getWorldPosition(new THREE.Vector3())); count++; }
            });
            if (count) worldPos.divideScalar(count);
        } else {
            mesh.getWorldPosition(worldPos);
        }

        const proj = worldPos.clone().project(camera);
        const sx = (proj.x * 0.5 + 0.5) * rect.width;
        const sy = (proj.y * -0.5 + 0.5) * rect.height;

        const label = document.getElementById(`label-${key}`);
        const path = document.getElementById(`path-${key}`);

        if (proj.z > 1 || sx < 0 || sx > rect.width || sy < 0 || sy > rect.height) {
            label.style.display = 'none';
            path.setAttribute('d', '');
            anchorDots[key].style.display = 'none';
            continue;
        }
        label.style.display = 'flex';
        anchorDots[key].style.display = 'block';

        anchorDots[key].setAttribute('cx', sx);
        anchorDots[key].setAttribute('cy', sy);

        let dx = sx + cfg.offsetX;
        let dy = sy + cfg.offsetY;
        const lw = label.offsetWidth || 130;
        const lh = label.offsetHeight || 50;

        dx = Math.max(6, Math.min(rect.width - lw - 6, dx));
        dy = Math.max(6, Math.min(rect.height - lh - 6, dy));

        label.style.left = `${dx}px`;
        label.style.top = `${dy}px`;

        const lx = dx + lw / 2;
        const ly = dy + lh / 2;
        const mx = (sx + lx) / 2;
        const my = sy;

        path.setAttribute('d', `M ${sx} ${sy} Q ${mx} ${my} ${lx} ${ly}`);

        if (globalState) {
            const health = globalState.parts[key].health;
            const color = colorFor(health);
            path.style.stroke = color;
            anchorDots[key].style.fill = color;
            path.style.opacity = health < 50 ? '0.85' : '0.5';
        }
    }
}

let viewMode = '3D';
const VIEWS = {
    '2D': { pos: new THREE.Vector3(0, 8.0, 0.01), look: new THREE.Vector3(0, 0, 0), orbit: false },
    '3D': { pos: new THREE.Vector3(3.0, 2.0, 4.0), look: new THREE.Vector3(0, 0, 0), orbit: true }
};

let isTransitioning = false;
const targetCamPos = new THREE.Vector3().copy(VIEWS['3D'].pos);
const targetCamLook = new THREE.Vector3().copy(VIEWS['3D'].look);

camera.position.copy(VIEWS['3D'].pos);
controls.target.copy(VIEWS['3D'].look);

function setViewMode(m) {
    viewMode = m;
    document.getElementById('btn-2d').classList.toggle('active', m === '2D');
    document.getElementById('btn-3d').classList.toggle('active', m === '3D');

    targetCamPos.copy(VIEWS[m].pos);
    targetCamLook.copy(VIEWS[m].look);
    isTransitioning = true;

    controls.enabled = (m === '3D');
}

setViewMode('3D');

function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
setTimeout(onResize, 0);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (isTransitioning) {
        camera.position.lerp(targetCamPos, 0.08);
        controls.target.lerp(targetCamLook, 0.08);

        if (camera.position.distanceTo(targetCamPos) < 0.02 && controls.target.distanceTo(targetCamLook) < 0.02) {
            camera.position.copy(targetCamPos);
            controls.target.copy(targetCamLook);
            isTransitioning = false;
        }
    }

    controls.update();

    for (const arr of Object.values(partsMeshes)) {
        arr.forEach(obj => obj.traverse(c => {
            if (c.isMesh && c.userData.pulsing) {
                c.material.emissiveIntensity = 0.2 + Math.abs(Math.sin(t * 8)) * 0.5;
            }
        }));
    }

    updateHUDLines();
    renderer.render(scene, camera);
}

animate();
updateUI(globalState);
update3DModel(globalState);
