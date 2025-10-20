// --- Control Variables ---
const LEAF_CONTROLS = {
    count: 25,           
    fallSpeedMin: 15000, 
    fallSpeedMax: 25000, 
    rotationSpeedMin: 4, 
    rotationSpeedMax: 10,  
    driftMin: -200,      
    driftMax: 200,       
    sizeMin: 20,         
    sizeMax: 35          
};

const FLIGHT_DATA = {
    startCoords: [21.0285, 105.8542], endCoords: [39.509001,-84.7337995], departureCity: "Hanoi (HAN)",
    arrivalCity: "OHIO (OH)", expectedDeparture: "Oct 18, 09:00", actualDeparture: "Oct 19, 20:00",
    landedTime: "Oct 21, 01:30", duration: "20h 30m (flight)", note: "Delayed for 13 hours due to bad conditions. 🥺"
};

// --- SVG Leaf Path ---
// load svg image of maple leaf
const mapleLeafPath = "M15 0 C 12 10, 5 12, 0 15 C 5 18, 7 25, 5 30 C 10 27, 12 20, 15 30 C 18 20, 20 27, 25 30 C 23 25, 25 18, 30 15 C 25 12, 18 10, 15 0 Z";

document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const heroContent = document.querySelector('.hero-content');
    const clouds = document.getElementById('clouds');
    const landscape = document.getElementById('landscape');
    const heartBalloonContainer = document.getElementById('heart-balloon-container');
    const heartBurstContainer = document.getElementById('heart-burst-container');
    const heroLeafContainer = document.getElementById('leaf-container');
    const mapSection = document.getElementById('map-section');
    
    const panoramaOverlay = document.getElementById('panorama-overlay');
    const panoLeafContainer = document.getElementById('pano-leaf-container');
    const audio = document.getElementById('background-audio');
    const letterModal = document.getElementById('letter-modal');
    const flowerModal = document.getElementById('flower-modal');
    
    let panoViewer = null; 
    let leafletMap = null; 
    let panoCloseListenerAttached = false; // Flag to attach listener only once

    // --- 1. Hero Animations (Mouse, Chevrons) ---
    anime({
        targets: '#scroll-wheel',
        translateY: [{ value: 0, duration: 800 }, { value: 8, duration: 800 }, { value: 0, duration: 800 }],
        opacity: [{ value: 1, duration: 400 }, { value: 0, duration: 400, delay: 800 }, { value: 1, duration: 400, delay: 400 }],
        loop: true, easing: 'easeInOutSine', delay: 300
    });
    anime({
        targets: '.chevron',
        translateY: [{ value: 0, duration: 0 }, { value: 10, duration: 1200 }],
        opacity: [{ value: 0, duration: 0 }, { value: 0.7, duration: 400 }, { value: 0, duration: 800, delay: 400 }],
        loop: true, easing: 'linear', delay: anime.stagger(300, {start: 500})
    });

    // --- 2. Parallax Scroll Effect ---
    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY;
        const viewportHeight = window.innerHeight;
        if (scrollPosition < viewportHeight) {
            heroContent.style.transform = `translateY(${scrollPosition * 0.4}px)`;
            heroContent.style.opacity = 1 - (scrollPosition / (viewportHeight / 1.5));
            clouds.style.transform = `translate(${scrollPosition * 0.1}px, ${scrollPosition * 0.5}px)`;
            landscape.style.transform = `translateY(${scrollPosition * 0.15}px)`;
            const balloonTransform = getComputedStyle(heartBalloonContainer).transform;
            let currentTranslateY = 0;
            if (balloonTransform !== 'none') { try { const matrix = new DOMMatrixReadOnly(balloonTransform); currentTranslateY = matrix.m42; } catch (e) {} }
            heartBalloonContainer.style.transform = `translateY(${currentTranslateY + (scrollPosition * 0.25)}px)`;
        }
    });

    // --- 3. Heart Balloon Animations & Interaction ---
    let floatingAnimation = anime({
        targets: heartBalloonContainer,
        translateY: [{ value: -10, duration: 2000 }, { value: 0, duration: 2000 }],
        translateX: [{ value: 5, duration: 1500 }, { value: -5, duration: 1500 }],
        loop: true, direction: 'alternate', easing: 'easeInOutSine', autoplay: true
    });
    heartBalloonContainer.addEventListener('click', () => {
        if (!heartBalloonContainer.classList.contains('burst')) {
            if (floatingAnimation) floatingAnimation.pause();
            heartBalloonContainer.style.animation = 'none';
            heartBalloonContainer.classList.add('burst');
            const bbox = heartBalloonContainer.getBoundingClientRect();
            burstHearts(bbox.left + bbox.width / 2, bbox.top + bbox.height / 2);
            anime({ targets: heartBalloonContainer, opacity: 0, scale: 0, duration: 500, easing: 'easeOutQuad', complete: () => heartBalloonContainer.style.display = 'none' });
        }
        leafParticleBurst();
    });
    function burstHearts(x, y) {
        for (let i = 0; i < 20; i++) {
            const heart = document.createElement('div');
            heart.classList.add('heart-particle');
            heart.style.left = `${x}px`; heart.style.top = `${y}px`;
            heartBurstContainer.appendChild(heart);
            const angle = Math.random() * Math.PI * 2, distance = Math.random() * 80 + 20;
            const endX = x + distance * Math.cos(angle), endY = y + distance * Math.sin(angle);
            anime({
                targets: heart, translateX: endX - x, translateY: endY - y, scale: [0.5, 1],
                opacity: [1, 0], rotate: Math.random() * 360, duration: Math.random() * 1000 + 800,
                easing: 'easeOutQuad', complete: () => heart.remove()
            });
        }
    }

    // --- 4. CONSOLIDATED LEAF FUNCTIONS ---
    
    // Generic function to animate one leaf
    function animateLeaf(leafElement, fallHeight) {
        function startFall() {
            const startX = anime.random(-100, window.innerWidth + 100);
            const drift = anime.random(LEAF_CONTROLS.driftMin, LEAF_CONTROLS.driftMax);
            const fallDuration = anime.random(LEAF_CONTROLS.fallSpeedMin, LEAF_CONTROLS.fallSpeedMax);
            const delay = anime.random(0, fallDuration / 2); // randomize start time

            // Reset position above screen
            anime.set(leafElement, {
                left: startX,
                translateY: -100,
                translateX: 0,
                opacity: 0,
                rotate: anime.random(-30, 30)
            });

            // Continuous smooth fall
            anime({
                targets: leafElement,
                translateY: [ -100, fallHeight + 100 ],
                translateX: [
                    { value: drift / 2, duration: fallDuration / 2, easing: 'easeInOutSine' },
                    { value: drift, duration: fallDuration / 2, easing: 'easeInOutSine' }
                ],
                rotate: anime.random(-180, 180),
                opacity: [
                    { value: 1, duration: 1000, easing: 'easeInSine' },
                    { value: 1, duration: fallDuration * 0.6 },
                    { value: 0, duration: 1000, easing: 'easeOutSine' }
                ],
                duration: fallDuration,
                delay,
                easing: 'easeInOutQuad',
                complete: startFall // recursively loop — continuous fall
            });
        }

        // Slow independent rotation animation
        anime({
            targets: leafElement,
            rotate: anime.random(-15, 15),
            direction: 'alternate',
            duration: anime.random(7000, 11000),
            easing: 'easeInOutSine',
            loop: true
        });

    startFall(); // start the continuous fall
}



    // Generic function to create one leaf in a container
    function createLeaf(container) {
        const leaf = document.createElement('div');
        leaf.classList.add('maple-leaf');
        
        const leafSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const leafPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        leafSvg.setAttribute('viewBox', '0 0 30 30');
        leafPath.setAttribute('d', mapleLeafPath);
        
        leafSvg.appendChild(leafPath);
        leaf.appendChild(leafSvg);
        
        const size = anime.random(LEAF_CONTROLS.sizeMin, LEAF_CONTROLS.sizeMax);
        leaf.style.width = `${size}px`;
        leaf.style.height = `${size}px`;
        leaf.style.opacity = Math.random();
        
        container.appendChild(leaf);
        
        // Use container.clientHeight to get the actual fall height
        animateLeaf(leaf, container.clientHeight); 
    }

    // Creates leaves for the HERO section
    function createHeroLeaves() {
        heroLeafContainer.innerHTML = ''; // Clear old
        for (let i = 0; i < LEAF_CONTROLS.count; i++) {
            createLeaf(heroLeafContainer);
        }
    }

    // Creates leaves for the PANORAMA section
    function createPanoLeaves() {
        panoLeafContainer.innerHTML = ''; // Clear old
        for (let i = 0; i < LEAF_CONTROLS.count; i++) {
            createLeaf(panoLeafContainer);
        }
    }

    // --- 5. Scroll Transition & Map Initialization ---
    let mapInitialized = false;
    function showFlightInfo() {
        const infoBox = document.getElementById('flight-info-container');
        infoBox.innerHTML = `<h3>${FLIGHT_DATA.departureCity} &rarr; ${FLIGHT_DATA.arrivalCity}</h3><p><strong>Exp. Departure:</strong> ${FLIGHT_DATA.expectedDeparture}</p><p><strong>Actual Departure:</strong> ${FLIGHT_DATA.actualDeparture}</p><p><strong>Landed Time:</strong> ${FLIGHT_DATA.landedTime}</p><p><strong>Duration:</strong> ${FLIGHT_DATA.duration}</p><p class="note">${FLIGHT_DATA.note}</p>`;
        infoBox.style.opacity = '1';
        infoBox.style.transform = 'scale(1)';
    }

    function initializeMap() {
        if (mapInitialized) return;
        mapInitialized = true;
        try {
            leafletMap = L.map('leaflet-map').setView([30, -30], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(leafletMap);
            L.polyline([FLIGHT_DATA.startCoords, FLIGHT_DATA.endCoords], { color: '#E6525C', weight: 3, opacity: 0.7, dashArray: '8, 8' }).addTo(leafletMap);
            var planeIcon = L.divIcon({ className: 'plane-icon', html: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`, iconSize: [40, 40], iconAnchor: [20, 20] });
            L.marker(FLIGHT_DATA.endCoords, {icon: planeIcon}).addTo(leafletMap);
            L.circleMarker(FLIGHT_DATA.startCoords, { radius: 6, fillColor: "#E6525C", color: "#2A2A2A", weight: 1, fillOpacity: 0.9 }).addTo(leafletMap);
            
            addPanoramaTrigger();
            
            setTimeout(showFlightInfo, 1000);
        } catch (e) { console.error("Leaflet map failed to initialize:", e); }
    }

    const mapObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                anime({ targets: mapSection, opacity: 1, translateY: 0, duration: 1200, easing: 'easeOutQuad', complete: initializeMap });
                mapObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.4 });
    

    // --- 6. Panorama Functions ---
    
    function addPanoramaTrigger() {
        const clickTrigger = document.createElement('div');
        clickTrigger.id = 'map-click-trigger';
        clickTrigger.innerHTML = `
            <div class="trigger-inner">
                <span class="emoji">😻</span>
                <div class="trigger-text">
                    <h3>See the View</h3>
                    <p>Miami University</p>
                </div>
            </div>
        `;
        mapSection.appendChild(clickTrigger);

        // Position near the destination marker
        const endPointPixels = leafletMap.latLngToContainerPoint(FLIGHT_DATA.endCoords);
        clickTrigger.style.left = `${endPointPixels.x - 20}px`;
        clickTrigger.style.top = `${endPointPixels.y + 100}px`;

        // Floating animation
        anime({
            targets: '#map-click-trigger',
            translateY: [{ value: -10, duration: 1000 }, { value: 0, duration: 1000 }],
            scale: [1, 1.03],
            opacity: [0.9, 1],
            loop: true,
            direction: 'alternate',
            easing: 'easeInOutSine'
        });

        clickTrigger.addEventListener('click', openPanorama);
    }

    
    function openPanorama() {
        panoramaOverlay.style.display = 'block';

        // **FIX:** Attach the close button listener here, one time only
        if (!panoCloseListenerAttached) {
            document.getElementById('pano-close-btn').addEventListener('click', () => {
                anime({
                    targets: panoramaOverlay,
                    opacity: 0,
                    duration: 500,
                    easing: 'easeInQuad',
                    complete: () => {
                        panoramaOverlay.style.display = 'none';
                        audio.pause();
                        audio.currentTime = 0;
                        panoLeafContainer.innerHTML = ''; // Clear leaves
                    }
                });
            });
            panoCloseListenerAttached = true;
        }

        anime({
            targets: panoramaOverlay,
            opacity: [0, 1],
            duration: 800,
            easing: 'easeOutQuad',
            begin: () => {
                // Start music immediately on click — user gesture
                audio.volume = 0.6;
                audio.play().catch(err => console.log("Autoplay blocked:", err));

                // Initialize viewer once
                if (!panoViewer) {
                    panoViewer = pannellum.viewer('panorama-viewer', {
                        "type": "equirectangular",
                        "panorama": "./assets/MIAMI2-ADDED.jpg",
                        "autoLoad": true,
                        "autoRotate": -2,
                        "hotSpots": [
                            { "pitch": -8, "yaw": 13, "cssClass": "custom-hotspot letter-hotspot", "clickHandlerFunc": showLetterModal },
                            { "pitch": -8, "yaw": -12, "cssClass": "custom-hotspot flower-hotspot", "clickHandlerFunc": showFlowerModal }
                        ]
                    });
                }
            },
            complete: () => {
                createPanoLeaves();
            }
        });

    }

    // --- 7. Modal Functions ---
    function showLetterModal() {
        letterModal.classList.add("active");
        anime.set('.letter-text', { opacity: 0, translateY: 15 });
        anime({
            targets: letterModal,
            opacity: [0, 1],
            scale: [0.95, 1],
            duration: 400,
            easing: 'easeOutQuad',
            complete: () => {
                anime({
                    targets: '.letter-text',
                    opacity: 1, translateY: 0, duration: 600,
                    delay: anime.stagger(150), easing: 'easeOutQuad'
                });
            }
        });
    }

    function showFlowerModal() {
        flowerModal.classList.add("active");

        anime.set(flowerModal, { opacity: 0, scale: 0.95 });

        anime({
            targets: flowerModal,
            opacity: [0, 1],
            scale: [0.95, 1],
            duration: 700,
            easing: 'easeOutQuad',
            complete: animateFlowerElegant
        });
    }

    function animateFlowerElegant() {
        const flower = document.getElementById('flower-img');
        anime.set(flower, { scale: 0.6, rotate: -10, opacity: 0 });

        // Elegant bloom animation
        anime({
            targets: flower,
            opacity: [0, 1],
            scale: [0.6, 1],
            rotate: [-10, 0],
            duration: 1500,
            easing: 'easeOutElastic(1, .6)',
            complete: startFireworkLoopRandom
        });

        // Gentle breathing pulse after bloom
        anime({
            targets: flower,
            scale: [1, 1.04],
            duration: 2500,
            direction: 'alternate',
            loop: true,
            easing: 'easeInOutSine'
        });

        anime({
            targets: '#flower-text',
            opacity: [0, 1],
            translateY: [-10, 0],
            duration: 1000,
            delay: 500,
            easing: 'easeOutQuad'
        });
    }

    let fireworkInterval = null;

    function startFireworkLoopRandom() {
        clearInterval(fireworkInterval);
        triggerFireworkRandom(); // first burst
        fireworkInterval = setInterval(triggerFireworkRandom, 2000); // repeat every 2s
    }

    function triggerFireworkRandom() {
        const burstContainer = document.getElementById('flower-particle-burst');
        const colors = ['#FFD700', '#FF6B6B', '#FF9A8B', '#FFB3C6', '#4BAF9A', '#FAD02E', '#FFF5BA'];
        const burstCount = 60;

        for (let i = 0; i < burstCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('firework-particle');
            burstContainer.appendChild(particle);

            const color = colors[Math.floor(Math.random() * colors.length)];
            const angle = Math.random() * Math.PI * 2;
            const distance = anime.random(50, 200);
            const offsetX = anime.random(-100, 100);
            const offsetY = anime.random(-100, 100);

            anime.set(particle, {
                background: color,
                width: anime.random(4, 8),
                height: anime.random(4, 8),
                opacity: 1,
                borderRadius: '50%',
                position: 'absolute',
                left: `calc(50% + ${offsetX}px)`,
                top: `calc(50% + ${offsetY}px)`,
                boxShadow: `0 0 10px ${color}`,
                translateX: 0,
                translateY: 0,
                scale: 0.8
            });

            anime({
                targets: particle,
                translateX: distance * Math.cos(angle),
                translateY: distance * Math.sin(angle),
                scale: [0.8, 1.5],
                opacity: [1, 0],
                duration: anime.random(1500, 2500),
                easing: 'easeOutExpo',
                complete: () => particle.remove()
            });
        }
    }

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.pano-modal');
            if (modal.id === 'flower-modal') {
                clearInterval(fireworkInterval);
                fireworkInterval = null;
                const burst = document.getElementById('flower-particle-burst');
                if (burst) burst.innerHTML = '';
            }
            modal.classList.remove("active");
            anime({
                targets: modal,
                opacity: 0,
                scale: 0.95,
                duration: 300,
                easing: 'easeInQuad',
                complete: () => modal.style.display = 'none'
            });
        });
    });

    function leafParticleBurst() {
        const burstContainer = document.getElementById('flower-particle-burst');
        burstContainer.innerHTML = '';
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.classList.add('leaf-particle');
            burstContainer.appendChild(particle);
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 80 + 20;
            anime({
                targets: particle,
                translateX: distance * Math.cos(angle),
                translateY: distance * Math.sin(angle),
                scale: [0, 1],
                opacity: [1, 0],
                rotate: anime.random(-180, 180),
                duration: anime.random(800, 1200),
                easing: 'easeOutQuad',
                complete: () => particle.remove()
            });
        }
    }


    // --- 8. Start Initial Animations ---
    
    // **FIX:** All leaf functions are now defined, so this call is safe.
    createHeroLeaves(); 
    
    // Start observing the map section
    mapObserver.observe(mapSection);
});