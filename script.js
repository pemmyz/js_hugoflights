window.addEventListener('load', function() {
    // --- CANVAS AND UI SETUP ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;

    // UI Elements
    const scoreElement = document.getElementById('score');
    const healthBar = document.getElementById('health-bar-inner');
    const fuelBar = document.getElementById('fuel-bar-inner');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const helpScreen = document.getElementById('help-screen');
    const finalScoreElement = document.getElementById('final-score');
    const gameOverReasonElement = document.getElementById('game-over-reason');
    const botModeDisplay = document.getElementById('bot-mode-display');
    
    // Buttons and Controls
    const startDayBtn = document.getElementById('start-day-button');
    const startNightBtn = document.getElementById('start-night-button');
    const helpBtn = document.getElementById('help-button');
    const closeHelpBtn = document.getElementById('close-help-button');
    const restartBtn = document.getElementById('restart-button');
    const volumeSlider = document.getElementById('volume-slider');
    const muteButton = document.getElementById('mute-button');
    const bottomHelpHint = document.getElementById('bottom-help-hint');

    // Developer Tools Elements
    const devControlsSection = document.getElementById('dev-controls-section');
    const devToggleHitboxes = document.getElementById('dev-toggle-hitboxes');
    const devToggleBotPath = document.getElementById('dev-toggle-bot-path');
    const devToggleBotTarget = document.getElementById('dev-toggle-bot-target');

    const autobotCountdownDisplay = document.createElement('div');
    autobotCountdownDisplay.id = 'autobot-countdown';
    autobotCountdownDisplay.style.display = 'none';
    document.getElementById('game-container').appendChild(autobotCountdownDisplay);


    // --- GAME VARIABLES ---
    let score, health, fuel, gameSpeed, gameOver, frame, isNightMode;
    let gameIsActive = false;
    let isPaused = false; 
    let animationFrameId;
    let gameOverReason = '';
    let damageMessage = { text: '', timer: 0 };
    
    // --- MODIFICATION START: Developer Mode State Enhancement ---
    let isDevMode = false; 
    let isFirstDevModeToggle = true; // New flag to handle first-time setup
    let devSettings = {
        showHitboxes: false,
        showBotPath: false,
        showBotTarget: false
    };
    // --- MODIFICATION END ---

    // --- AUTOBOT/IDLE MODE ---
    let idleTimer;
    let autobotCountdown = 7; 
    let countdownInterval;
    
    let isBotActive = false;
    let activeBotMode = 1; 
    let botTarget = null; 

    // --- AUDIO SETUP ---
    let audioCtx, masterGain;
    let engineSound, collectSound, damageSound;
    let currentVolume = 0.1; 
    let isMuted = false;

    function setupAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        masterGain = audioCtx.createGain();
        masterGain.gain.value = isMuted ? 0 : Math.pow(currentVolume, 2);
        masterGain.connect(audioCtx.destination);
        
        const engineNode = audioCtx.createOscillator();
        const engineGain = audioCtx.createGain();
        const lfo = audioCtx.createOscillator();
        engineNode.type = 'sawtooth';
        engineNode.frequency.value = 60;
        lfo.type = 'square';
        lfo.frequency.value = 10;
        lfo.connect(engineGain.gain);
        engineNode.connect(engineGain);
        engineGain.connect(masterGain);
        engineGain.gain.value = 0.0042;
        engineNode.start();
        lfo.start();
        engineSound = { node: engineNode, gain: engineGain, lfo, isPlaying: false };
        
        collectSound = () => {
            if (!audioCtx) return;
            const node = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            node.type = 'sine';
            node.frequency.value = 600;
            gain.gain.setValueAtTime(0.9, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            node.connect(gain);
            gain.connect(masterGain);
            node.start();
            node.stop(audioCtx.currentTime + 0.3);
        };

        damageSound = () => {
            if (!audioCtx) return;
            const node = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            node.type = 'square';
            node.frequency.value = 150;
            gain.gain.setValueAtTime(1.0, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
            node.connect(gain);
            gain.connect(masterGain);
            node.start();
            node.stop(audioCtx.currentTime + 0.5);
        };
    }
    
    function toggleEngineSound(play) {
        if (!audioCtx || !engineSound) return;
        if (play && !engineSound.isPlaying) {
            engineSound.gain.gain.value = 0.0042;
            engineSound.isPlaying = true;
        } else if (!play && engineSound.isPlaying) {
            engineSound.gain.gain.value = 0;
            engineSound.isPlaying = false;
        }
    }


    // --- GAME OBJECTS ---
    let player, blueBalls, redBalls, clouds, thunderClouds;
    const playerProto = {
        x: 100, y: 300, width: 80, height: 40, velocityY: 0, thrust: -0.25, gravity: 0.1, isThrusting: false,
        draw() {
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#87CEEB';
            ctx.beginPath();
            ctx.arc(this.x + this.width - 15, this.y + 15, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.stroke();
            ctx.fillStyle = '#A9A9A9';
            ctx.fillRect(this.x + 20, this.y - 15, 15, this.height + 30);
            ctx.fillRect(this.x - 10, this.y + 10, 10, 20);
            ctx.fillRect(this.x - 15, this.y + 10, 20, 10);
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            const pX = this.x + this.width + 5, pY = this.y + this.height / 2;
            ctx.moveTo(pX, pY);
            ctx.arc(pX, pY, 15, frame * 0.3, frame * 0.3 + 1);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(pX, pY);
            ctx.arc(pX, pY, 15, frame * 0.3 + Math.PI, frame * 0.3 + Math.PI + 1);
            ctx.fill();
        },
        update() {
            if (this.isThrusting) this.velocityY += this.thrust;
            this.velocityY += this.gravity;
            this.y += this.velocityY;
            if (this.y < 0) { this.y = 0; this.velocityY = 0; }
            if (this.y > canvas.height - this.height) { this.y = canvas.height - this.height; this.velocityY = 0; }
        }
    };
    class Ball {
        constructor(x, y, radius, color) { this.x = x; this.y = y; this.radius = radius; this.color = color; }
        draw() { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); }
        update() { this.x -= gameSpeed; }
    }
    class Cloud {
        constructor(x, y, isThunder = false) {
            this.x = x; this.y = y; this.isThunder = isThunder; this.puffs = [];
            
            const numPuffs = 10 + Math.random() * 5;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (let i = 0; i < numPuffs; i++) {
                const offsetX = (Math.random() - 0.5) * 150;
                const offsetY = (Math.random() - 0.5) * 50;
                const radius = 20 + Math.random() * 20;
                this.puffs.push({ x: offsetX, y: offsetY, radius });
                
                minX = Math.min(minX, offsetX - radius);
                maxX = Math.max(maxX, offsetX + radius);
                minY = Math.min(minY, offsetY - radius);
                maxY = Math.max(maxY, offsetY + radius);
            }
            this.boundingBoxOffsetX = minX;
            this.boundingBoxOffsetY = minY;
            this.width = maxX - minX;
            this.height = maxY - minY;
        }
        draw() {
            this.puffs.forEach(puff => {
                let color = this.isThunder ? (isNightMode ? 'rgba(40, 40, 50, 0.8)' : 'rgba(80, 80, 90, 0.8)') : (isNightMode ? 'rgba(100, 100, 120, 0.6)' : 'rgba(255, 255, 255, 0.7)');
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(this.x + puff.x, this.y + puff.y, puff.radius, 0, Math.PI * 2); ctx.fill();
            });
            if (this.isThunder && Math.random() < 0.05) this.drawLightning();
        }
        drawLightning() {
            ctx.strokeStyle = 'yellow'; ctx.lineWidth = 3; ctx.beginPath();
            const startX = this.x + (Math.random() - 0.5) * 50;
            const startY = this.y + (Math.random() - 0.5) * 20;
            ctx.moveTo(startX, startY);
            for (let i = 1; i <= 5; i++) { ctx.lineTo(startX + (Math.random() - 0.5) * 40, startY + i * 20); }
            ctx.stroke(); ctx.lineWidth = 1;
        }
        update() { this.x -= gameSpeed * (this.isThunder ? 0.6 : 0.4); }
    }

    // --- PAGE VISIBILITY API FOR AUDIO ---
    function handleVisibilityChange() {
        if (!audioCtx) return;
        if (document.hidden) {
            if (gameIsActive && !isPaused) {
                isPaused = true;
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            if (audioCtx.state === 'running') audioCtx.suspend();
        } else {
            if (gameIsActive && isPaused && helpScreen.style.display !== 'block') {
                isPaused = false;
                if (!animationFrameId) animate();
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }
    }

    // --- INPUT AND EVENT LISTENERS ---
    function setupEventListeners() {
        const startThrust = (e) => {
            if (gameOver || isPaused || !player || isBotActive) return;
            e.preventDefault();
            player.isThrusting = true;
        };
        const endThrust = (e) => {
            if (gameOver || isPaused || !player || isBotActive) return;
            e.preventDefault();
            player.isThrusting = false;
        };

        const stopAutobotOnInteraction = () => {
            if (isBotActive) { 
                stopAutobotAndShowMenu();
            } else { 
                clearTimeout(idleTimer);
                clearInterval(countdownInterval);
                autobotCountdownDisplay.style.display = 'none';
            }
        };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyH') {
                if (gameOverScreen.style.display === 'block') return;
                toggleHelpScreen(helpScreen.style.display !== 'block');
                return;
            }

            if (isPaused) return;

            if (gameIsActive) {
                if (e.code === 'KeyB') {
                    isBotActive = !isBotActive;
                    console.log(`%cBot Mode is now ${isBotActive ? 'ACTIVE' : 'INACTIVE'} (Mode ${activeBotMode})`, 'color: #00A0F0; font-weight: bold;');
                    if (!isBotActive) {
                        player.isThrusting = false;
                        botTarget = null; 
                    }
                    return; 
                }
                if (['1', '2', '3', '4'].includes(e.key)) {
                    activeBotMode = parseInt(e.key);
                    console.log(`%cBot personality set to: ${activeBotMode}`, 'color: #00A0F0; font-weight: bold;');
                    return; 
                }
                // --- MODIFICATION START: New D-Key Logic ---
                if (e.code === 'KeyD') {
                    isDevMode = !isDevMode; // Toggle the master dev mode switch

                    // If this is the very first time we've ever enabled dev mode in this session...
                    if (isDevMode && isFirstDevModeToggle) {
                        // Set the default settings
                        devSettings.showHitboxes = true;
                        devSettings.showBotTarget = true;
                        
                        // Now, prevent this block from ever running again
                        isFirstDevModeToggle = false; 
                    }
                    
                    // Sync the checkboxes with the current state of devSettings.
                    // This ensures the UI reflects the programmatic changes or remembers manual ones.
                    devToggleHitboxes.checked = devSettings.showHitboxes;
                    devToggleBotTarget.checked = devSettings.showBotTarget;
                    devToggleBotPath.checked = devSettings.showBotPath;

                    // Also, control the visibility of the section in the help menu.
                    devControlsSection.style.display = isDevMode ? 'block' : 'none';
                    
                    console.log('Dev Mode:', isDevMode ? 'ON' : 'OFF');
                    return;
                }
                // --- MODIFICATION END ---
            }

            if (e.code === 'Space' || e.code === 'ArrowUp') startThrust(e);
            
            stopAutobotOnInteraction();
        });

        window.addEventListener('keyup', (e) => {
            if (isPaused) return;
            if (e.code === 'Space' || e.code === 'ArrowUp') endThrust(e);
        });

        canvas.addEventListener('mousedown', startThrust);
        canvas.addEventListener('mouseup', endThrust);
        canvas.addEventListener('touchstart', startThrust);
        canvas.addEventListener('touchend', endThrust);
        canvas.addEventListener('mouseleave', endThrust);

        window.addEventListener('mousedown', stopAutobotOnInteraction);
        window.addEventListener('touchstart', stopAutobotOnInteraction);
        
        volumeSlider.addEventListener('input', (e) => {
            currentVolume = parseFloat(e.target.value);
            if (masterGain) {
                const newGain = Math.pow(currentVolume, 2);
                masterGain.gain.setTargetAtTime(newGain, audioCtx.currentTime, 0.01);
            }
            isMuted = currentVolume <= 0.01;
            muteButton.textContent = isMuted ? "Unmute" : "Mute";
        });

        muteButton.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) {
                if (masterGain) masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
                volumeSlider.value = 0;
            } else {
                currentVolume = currentVolume > 0.01 ? currentVolume : 0.1;
                volumeSlider.value = currentVolume;
                if (masterGain) masterGain.gain.setTargetAtTime(Math.pow(currentVolume, 2), audioCtx.currentTime, 0.01);
            }
            muteButton.textContent = isMuted ? "Unmute" : "Mute";
        });

        devToggleHitboxes.addEventListener('change', () => { devSettings.showHitboxes = devToggleHitboxes.checked; });
        devToggleBotPath.addEventListener('change', () => { devSettings.showBotPath = devToggleBotPath.checked; });
        devToggleBotTarget.addEventListener('change', () => { devSettings.showBotTarget = devToggleBotTarget.checked; });
    }

    // --- BOT AI ALGORITHMS ---
    function botMode_Collector() {
        botTarget = null;
        let target = null;
        let closestDist = Infinity;
        blueBalls.forEach(ball => {
            const dist = ball.x - (player.x + player.width);
            if (dist > 0 && dist < closestDist) {
                closestDist = dist;
                target = ball;
            }
        });
        botTarget = target;
        if (target) {
            let targetY = target.y;
            if (player.y > targetY + 5) player.isThrusting = true;
            else if (player.y < targetY - 5) player.isThrusting = false;
        } else {
            player.isThrusting = false;
        }
    }
    
    function isPathToTargetSafe(target, threats, margin) {
        const pathTop = Math.min(player.y, target.y) - margin;
        const pathBottom = Math.max(player.y + player.height, target.y) + margin;
        const pathLeft = player.x + player.width;
        const pathRight = target.x;

        for (const threat of threats) {
            let threatLeft, threatRight, threatTop, threatBottom;
            if (threat instanceof Ball) {
                threatLeft = threat.x - threat.radius;
                threatRight = threat.x + threat.radius;
                threatTop = threat.y - threat.radius;
                threatBottom = threat.y + threat.radius;
            } else { // Cloud
                threatLeft = threat.x + threat.boundingBoxOffsetX;
                threatRight = threatLeft + threat.width;
                threatTop = threat.y + threat.boundingBoxOffsetY;
                threatBottom = threatTop + threat.height;
            }
            if (pathLeft < threatRight && pathRight > threatLeft &&
                pathTop < threatBottom && pathBottom > threatTop) {
                return false;
            }
        }
        return true;
    }

    function botMode_Smart() {
        botTarget = null; 
        const allThreats = [...redBalls, ...thunderClouds];
        const DANGER_ZONE_RADIUS = 225; 
        const SAFE_PATH_MARGIN = player.height * 0.75; 
        let mostUrgentThreat = null;
        let minThreatDist = Infinity;
        allThreats.forEach(threat => {
            const dist = threat.x - (player.x + player.width);
            if (dist > -threat.width && dist < minThreatDist) {
                minThreatDist = dist;
                mostUrgentThreat = threat;
            }
        });
        if (mostUrgentThreat && minThreatDist < DANGER_ZONE_RADIUS) {
            let threatTop, threatBottom;
            const evadeMargin = player.height * 1.5;
            if (mostUrgentThreat instanceof Ball) {
                threatTop = mostUrgentThreat.y - mostUrgentThreat.radius;
                threatBottom = mostUrgentThreat.y + mostUrgentThreat.radius;
            } else { // Cloud
                threatTop = mostUrgentThreat.y + mostUrgentThreat.boundingBoxOffsetY;
                threatBottom = threatTop + mostUrgentThreat.height;
            }
            const evadeY = Math.abs(player.y - (threatTop - evadeMargin)) < Math.abs(player.y - (threatBottom + evadeMargin))
                ? threatTop - evadeMargin
                : threatBottom + evadeMargin;
            botTarget = { x: mostUrgentThreat.x, y: evadeY, isVirtual: true };
            player.isThrusting = player.y > evadeY;
            return; 
        }
        let bestCollectible = null;
        let minCollectibleDist = Infinity;
        blueBalls.forEach(ball => {
            const dist = ball.x - (player.x + player.width);
            if (dist > 0 && dist < minCollectibleDist) {
                minCollectibleDist = dist;
                bestCollectible = ball;
            }
        });
        if (bestCollectible) {
            if (isPathToTargetSafe(bestCollectible, allThreats, SAFE_PATH_MARGIN)) {
                botTarget = bestCollectible;
                player.isThrusting = player.y > bestCollectible.y;
                return;
            }
        }
        const middleY = canvas.height / 2;
        botTarget = { x: player.x + 200, y: middleY, isVirtual: true };
        if (Math.abs(player.y - middleY) < 20) {
            player.isThrusting = false; 
        } else {
            player.isThrusting = player.y > middleY;
        }
    }
    
    function botMode_Avoider() {
        botTarget = null;
        const threats = [...redBalls, ...thunderClouds];
        let closestThreat = null;
        let minThreatDist = 450;
        threats.forEach(threat => {
            const dist = threat.x - (player.x + player.width);
            if (dist > -threat.width && dist < minThreatDist) {
                closestThreat = threat;
                minThreatDist = dist;
            }
        });
        if (closestThreat) {
            let threatTop, threatBottom;
            const safeMargin = player.height * 1.8;
            if (closestThreat instanceof Ball) {
                threatTop = closestThreat.y - closestThreat.radius;
                threatBottom = closestThreat.y + closestThreat.radius;
            } else { 
                threatTop = closestThreat.y + closestThreat.boundingBoxOffsetY;
                threatBottom = threatTop + closestThreat.height;
            }
            const targetY = Math.abs(player.y - (threatTop - safeMargin)) < Math.abs(player.y - (threatBottom + safeMargin))
                    ? threatTop - safeMargin
                    : threatBottom + safeMargin;
            botTarget = { x: closestThreat.x, y: targetY, isVirtual: true, };
            player.isThrusting = player.y > targetY;
        } else {
            const middleY = canvas.height / 2;
            botTarget = { x: player.x + 200, y: middleY, isVirtual: true, };
            if (player.y > middleY + 10) player.isThrusting = true;
            else if (player.y < middleY - 10) player.isThrusting = false;
            else player.isThrusting = false;
        }
    }

    function botMode_Kamikaze() {
        botTarget = null;
        let target = null;
        let closestDist = Infinity;
        const allThreats = [...redBalls, ...thunderClouds];
        allThreats.forEach(threat => {
             const dist = (threat.x) - (player.x + player.width);
             if (dist > -50 && dist < closestDist) {
                 closestDist = dist;
                 target = threat;
             }
        });
        botTarget = target;
        if (target) {
            let targetY;
            if (target instanceof Ball) {
                targetY = target.y;
            } else {
                targetY = target.y + target.boundingBoxOffsetY + (target.height / 2);
            }
            if (player.y > targetY + 5) player.isThrusting = true;
            else if (player.y < targetY - 5) player.isThrusting = false;
            else player.isThrusting = false;
        } else {
            player.isThrusting = false;
        }
    }


    // --- GAME STATE & LOOP ---
    function showStartScreen() {
        gameIsActive = false;
        isPaused = false;
        isBotActive = false;
        startScreen.style.display = 'flex';
        gameOverScreen.style.display = 'none';
        helpScreen.style.display = 'none';
        botModeDisplay.style.display = 'none';
        document.body.className = '';
        clearTimeout(idleTimer);
        clearInterval(countdownInterval);
        autobotCountdownDisplay.style.display = 'none';
        if (audioCtx) audioCtx.suspend();
        idleTimer = setTimeout(() => startAutobotCountdown(), 7000);
    }
    
    function toggleHelpScreen(show) {
        if (gameIsActive) {
            isPaused = show;
            if (isPaused) {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                if (audioCtx) audioCtx.suspend();
                helpScreen.style.display = 'block';
                devControlsSection.style.display = isDevMode ? 'block' : 'none';
            } else {
                helpScreen.style.display = 'none';
                if (audioCtx && audioCtx.state === 'suspended' && !document.hidden) {
                    audioCtx.resume();
                }
                if (!animationFrameId) { 
                    animate(); 
                }
            }
        } else {
            helpScreen.style.display = show ? 'block' : 'none';
            if (show) {
                devControlsSection.style.display = isDevMode ? 'block' : 'none';
            }
            clearTimeout(idleTimer);
            clearInterval(countdownInterval);
            autobotCountdownDisplay.style.display = 'none';
            startScreen.style.display = show ? 'none' : 'flex';
            if (!show) { 
                 idleTimer = setTimeout(() => startAutobotCountdown(), 7000);
            }
        }
    }
    
    function startAutobotCountdown() {
        autobotCountdown = 7;
        autobotCountdownDisplay.textContent = `Autobot demo starting in ${autobotCountdown}...`;
        autobotCountdownDisplay.style.display = 'block';
        countdownInterval = setInterval(() => {
            autobotCountdown--;
            if (autobotCountdown <= 0) {
                clearInterval(countdownInterval);
                autobotCountdownDisplay.style.display = 'none';
                startGame(Math.random() > 0.5, true); 
            } else {
                autobotCountdownDisplay.textContent = `Autobot demo starting in ${autobotCountdown}...`;
            }
        }, 1000);
    }

    function stopAutobotAndShowMenu() {
        isBotActive = false;
        gameOver = true;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        showStartScreen();
    }
    
    function startGame(nightMode, startWithBot = false) {
        gameIsActive = true;
        isPaused = false; 
        gameOverReason = '';
        damageMessage = { text: '', timer: 0 };
        clearTimeout(idleTimer);
        clearInterval(countdownInterval);
        autobotCountdownDisplay.style.display = 'none';
        setupAudio();
        if (audioCtx && audioCtx.state === 'suspended' && !document.hidden) {
            audioCtx.resume();
        }
        score = 0; health = 100; fuel = 100;
        gameSpeed = 3; gameOver = false; frame = 0;
        isNightMode = nightMode;
        isBotActive = startWithBot;
        activeBotMode = 2;
        botTarget = null;
        player = Object.create(playerProto);
        player.y = 300; player.velocityY = 0;
        blueBalls = []; redBalls = []; clouds = []; thunderClouds = [];
        document.body.className = isNightMode ? 'night-mode' : '';
        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        updateUI();
        toggleEngineSound(true);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animate();
    }
    
    function endGame() {
        if (gameOver) return;
        gameOver = true;
        gameIsActive = false;
        isBotActive = false;
        botTarget = null;
        toggleEngineSound(false);
        if (audioCtx) audioCtx.suspend();
        gameOverReasonElement.textContent = gameOverReason;
        finalScoreElement.textContent = score;
        gameOverScreen.style.display = 'block';
        clearTimeout(idleTimer);
        clearInterval(countdownInterval);
    }

    function handleObjectGeneration() {
        if (frame % 150 === 0) clouds.push(new Cloud(canvas.width + 100, Math.random() * canvas.height * 0.8));
        if (frame % 350 === 0) thunderClouds.push(new Cloud(canvas.width + 200, Math.random() * canvas.height * 0.8, true));
        if (frame % 70 === 0) blueBalls.push(new Ball(canvas.width + 20, Math.random() * canvas.height, 10, 'blue'));
        if (frame % 100 === 0) redBalls.push(new Ball(canvas.width + 20, Math.random() * canvas.height, 12, 'red'));
    }

    function updateAndDrawObjects() {
        [...clouds, ...thunderClouds, ...blueBalls, ...redBalls].forEach(obj => {
            obj.update();
            obj.draw();
        });
        clouds = clouds.filter(c => c.x + c.width + c.boundingBoxOffsetX > 0);
        thunderClouds = thunderClouds.filter(c => c.x + c.width + c.boundingBoxOffsetX > 0);
        blueBalls = blueBalls.filter(b => b.x + b.radius > 0);
        redBalls = redBalls.filter(b => b.x + b.radius > 0);
    }
    
    function checkCollisions() {
        redBalls.forEach((ball, index) => {
            const dist = Math.hypot(player.x + player.width / 2 - ball.x, player.y + player.height / 2 - ball.y);
            if (dist < ball.radius + player.height / 2) {
                redBalls.splice(index, 1);
                health -= 20;
                damageMessage = { text: 'Hit a Red Ball!', timer: 120 };
                if (!isBotActive) damageSound();
            }
        });
        thunderClouds.forEach((cloud) => {
            const playerHitboxX = player.x + player.width * 0.15, playerHitboxY = player.y + player.height * 0.15;
            const playerHitboxWidth = player.width * 0.7, playerHitboxHeight = player.height * 0.7;
            const cloudHitboxX = cloud.x + cloud.boundingBoxOffsetX, cloudHitboxY = cloud.y + cloud.boundingBoxOffsetY;
            if (playerHitboxX < cloudHitboxX + cloud.width && playerHitboxX + playerHitboxWidth > cloudHitboxX &&
                playerHitboxY < cloudHitboxY + cloud.height && playerHitboxY + playerHitboxHeight > cloudHitboxY) {
                health -= 0.5;
                if (damageMessage.timer <= 0) damageMessage = { text: 'In a Thunder Cloud!', timer: 120 };
                if (frame % 30 === 0 && !isBotActive) damageSound();
            }
        });
        blueBalls.forEach((ball, index) => {
            const dist = Math.hypot(player.x + player.width / 2 - ball.x, player.y + player.height / 2 - ball.y);
            if (dist < ball.radius + player.height / 2) {
                blueBalls.splice(index, 1);
                score += 10;
                fuel = Math.min(100, fuel + 5);
                if (!isBotActive) collectSound();
            }
        });
    }

    function updateUI() {
        scoreElement.textContent = `Score: ${score}`;
        healthBar.style.width = `${Math.max(0, health)}%`;
        fuelBar.style.width = `${Math.max(0, fuel)}%`;
        if (health < 30) healthBar.style.backgroundColor = '#e74c3c';
        else if (health < 60) healthBar.style.backgroundColor = '#f1c40f';
        else healthBar.style.backgroundColor = '#4CAF50';
    }
    
    function updateGameStatus() {
        fuel -= player.isThrusting ? 0.12 : 0.04;
        if (health <= 0) {
            health = 0;
            gameOverReason = "Ran out of health!";
            endGame();
        } else if (fuel <= 0) {
            fuel = 0;
            gameOverReason = "Ran out of fuel!";
            endGame();
        }
        updateUI();
    }
    
    function drawDamageMessage() {
        if (damageMessage.timer > 0) {
            ctx.font = '24px Arial';
            ctx.textAlign = 'right';
            ctx.fillStyle = `rgba(255, 50, 50, ${Math.min(1, damageMessage.timer / 60)})`;
            ctx.fillText(damageMessage.text, canvas.width - 20, canvas.height - 20);
            damageMessage.timer--;
        }
    }
    
    function drawBotModeStatus() {
        if (isBotActive) {
            let modeName = "Unknown";
            switch(activeBotMode) {
                case 1: modeName = "Collector"; break;
                case 2: modeName = "Smart"; break;
                case 3: modeName = "Avoider"; break;
                case 4: modeName = "Kamikaze"; break;
            }
            botModeDisplay.innerHTML = `Bot Mode: ${modeName}<br>(${activeBotMode})`;
            botModeDisplay.style.display = 'block';
        } else {
            botModeDisplay.style.display = 'none';
        }
    }

    // --- MODIFICATION START: Updated drawDevInfo function ---
    function drawDevInfo() {
        // Master switch: if dev mode is off, do nothing at all.
        if (!isDevMode || !player) return;

        // The rest of the logic now only runs if the master switch is on.
        if (devSettings.showHitboxes) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'; ctx.lineWidth = 2;
            const playerHitboxX = player.x + player.width * 0.15, playerHitboxY = player.y + player.height * 0.15;
            const playerHitboxWidth = player.width * 0.7, playerHitboxHeight = player.height * 0.7;
            ctx.strokeRect(playerHitboxX, playerHitboxY, playerHitboxWidth, playerHitboxHeight);
            
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; ctx.lineWidth = 2;
            thunderClouds.forEach(cloud => {
                const cloudHitboxX = cloud.x + cloud.boundingBoxOffsetX, cloudHitboxY = cloud.y + cloud.boundingBoxOffsetY;
                ctx.strokeRect(cloudHitboxX, cloudHitboxY, cloud.width, cloud.height);
            });
        }

        if (isBotActive && botTarget) {
            ctx.save();
            let targetX, targetY;

            if (botTarget.isVirtual) {
                targetX = botTarget.x;
                targetY = botTarget.y;
            } else if (botTarget instanceof Ball) {
                targetX = botTarget.x;
                targetY = botTarget.y;
            } else if (botTarget instanceof Cloud) {
                targetX = botTarget.x + botTarget.boundingBoxOffsetX + botTarget.width / 2;
                targetY = botTarget.y + botTarget.boundingBoxOffsetY + botTarget.height / 2;
            }

            if (targetX !== undefined && targetY !== undefined) {
                if (devSettings.showBotPath) {
                    ctx.beginPath();
                    ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
                    ctx.lineTo(targetX, targetY);
                    ctx.strokeStyle = 'cyan';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                if (devSettings.showBotTarget) {
                    ctx.strokeStyle = botTarget.isVirtual ? 'yellow' : 'lime';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(targetX, targetY, 20, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
    }
    // --- MODIFICATION END ---

    function animate() {
        if (gameOver) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        handleObjectGeneration();
        
        if (isBotActive && player) {
            switch(activeBotMode) {
                case 1: botMode_Collector(); break;
                case 2: botMode_Smart(); break;
                case 3: botMode_Avoider(); break;
                case 4: botMode_Kamikaze(); break;
                default: player.isThrusting = false; botTarget = null;
            }
        }
        
        player.update();
        
        updateAndDrawObjects();
        player.draw();
        
        drawBotModeStatus();
        drawDamageMessage();
        drawDevInfo();
        checkCollisions();
        updateGameStatus();

        frame++;
        animationFrameId = requestAnimationFrame(animate);
    }

    // --- INITIALIZE ---
    function init() {
        startDayBtn.addEventListener('click', () => startGame(false));
        startNightBtn.addEventListener('click', () => startGame(true));
        restartBtn.addEventListener('click', showStartScreen);
        helpBtn.addEventListener('click', () => toggleHelpScreen(true));
        closeHelpBtn.addEventListener('click', () => toggleHelpScreen(false));
        
        bottomHelpHint.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });
        
        bottomHelpHint.addEventListener('click', () => {
            if (gameOverScreen.style.display === 'block') return;
            const isHelpVisible = helpScreen.style.display === 'block';
            toggleHelpScreen(!isHelpVisible);
        });
        
        setupEventListeners();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        volumeSlider.value = currentVolume;
        muteButton.textContent = isMuted ? "Unmute" : "Mute";

        devToggleHitboxes.checked = devSettings.showHitboxes;
        devToggleBotPath.checked = devSettings.showBotPath;
        devToggleBotTarget.checked = devSettings.showBotTarget;

        showStartScreen();
    }
    
    init();
});
