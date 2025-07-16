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
    
    // Buttons and Controls
    const startDayBtn = document.getElementById('start-day-button');
    const startNightBtn = document.getElementById('start-night-button');
    const helpBtn = document.getElementById('help-button');
    const closeHelpBtn = document.getElementById('close-help-button');
    const restartBtn = document.getElementById('restart-button');
    const volumeSlider = document.getElementById('volume-slider');
    const muteButton = document.getElementById('mute-button');
    const bottomHelpHint = document.getElementById('bottom-help-hint');

    const autobotCountdownDisplay = document.createElement('div');
    autobotCountdownDisplay.id = 'autobot-countdown';
    autobotCountdownDisplay.style.display = 'none';
    document.getElementById('game-container').appendChild(autobotCountdownDisplay);


    // --- GAME VARIABLES ---
    let score, health, fuel, gameSpeed, gameOver, frame, isNightMode, isAutobotMode;
    let animationFrameId;
    let gameOverReason = '';
    let damageMessage = { text: '', timer: 0 };
    let isDevMode = false;


    // --- AUTOBOT/IDLE MODE ---
    let idleTimer;
    let autobotCountdown = 7; 
    let countdownInterval;


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
                let color;
                if (this.isThunder) {
                    color = isNightMode ? 'rgba(40, 40, 50, 0.8)' : 'rgba(80, 80, 90, 0.8)';
                } else {
                    color = isNightMode ? 'rgba(100, 100, 120, 0.6)' : 'rgba(255, 255, 255, 0.7)';
                }
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


    // --- INPUT AND EVENT LISTENERS ---
    function setupEventListeners() {
        const startThrust = (e) => {
            if (gameOver || !player) return;
            e.preventDefault();
            player.isThrusting = true;
        };
        const endThrust = (e) => {
            if (gameOver || !player) return;
            e.preventDefault();
            player.isThrusting = false;
        };

        const stopAutobotOnInteraction = () => {
            if (isAutobotMode) {
                stopAutobotAndShowMenu();
            } else {
                clearTimeout(idleTimer);
                clearInterval(countdownInterval);
                autobotCountdownDisplay.style.display = 'none';
            }
        };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') startThrust(e);
            if (e.code === 'KeyH') toggleHelpScreen(true);
            if (e.code === 'KeyD') {
                isDevMode = !isDevMode;
                console.log('Dev Mode:', isDevMode ? 'ON' : 'OFF');
            }
            stopAutobotOnInteraction();
        });
        window.addEventListener('keyup', (e) => {
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
            if (currentVolume > 0 && isMuted) {
                isMuted = false;
                muteButton.textContent = "Mute";
            } else if (currentVolume <= 0.01 && !isMuted) {
                isMuted = true;
                muteButton.textContent = "Unmute";
            }
        });

        muteButton.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) {
                if (masterGain) masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
                volumeSlider.value = 0;
                muteButton.textContent = "Unmute";
            } else {
                if (masterGain) masterGain.gain.setTargetAtTime(Math.pow(currentVolume, 2), audioCtx.currentTime, 0.01);
                volumeSlider.value = currentVolume;
                muteButton.textContent = "Mute";
            }
        });
    }

    // --- AUTOBOT AI LOGIC ---
    function runAutobotAI(){
        let targetY = canvas.height / 2;
        const threats = [...redBalls, ...thunderClouds];
        let closestThreat = null;
        let minThreatDist = 350;

        threats.forEach(t => {
            if (t.x > player.x - 50 && t.x < player.x + 350) {
                const dist = t.x - player.x;
                if (dist < minThreatDist) {
                    minThreatDist = dist;
                    closestThreat = t;
                }
            }
        });

        if (closestThreat) {
            const threatCenterY = (closestThreat.y + closestThreat.boundingBoxOffsetY) + (closestThreat.height / 2);
            if (player.y > threatCenterY - 50) {
                targetY = player.y - 100;
            } else {
                targetY = player.y + 100;
            }
        } else {
            let closestBall = null;
            let minBallDist = 400;
            blueBalls.forEach(b => {
                if (b.x > player.x && b.x < player.x + 400) {
                    const dist = b.x - player.x;
                    if (dist < minBallDist) {
                        minBallDist = dist;
                        closestBall = b;
                    }
                }
            });
            if (closestBall) {
                targetY = closestBall.y;
            }
        }
        if (player.y > targetY) {
            player.isThrusting = true;
        } else {
            player.isThrusting = false;
        }
    }

    // --- GAME STATE & LOOP ---
    function showStartScreen() {
        startScreen.style.display = 'flex';
        gameOverScreen.style.display = 'none';
        helpScreen.style.display = 'none';
        document.body.className = '';
        
        clearTimeout(idleTimer);
        clearInterval(countdownInterval);
        autobotCountdownDisplay.style.display = 'none';
        
        idleTimer = setTimeout(() => {
            startAutobotCountdown();
        }, 7000);
    }
    
    function toggleHelpScreen(show) {
        clearTimeout(idleTimer);
        clearInterval(countdownInterval);
        autobotCountdownDisplay.style.display = 'none';
        
        helpScreen.style.display = show ? 'block' : 'none';
        startScreen.style.display = show ? 'none' : 'flex';
        
        if (!show) {
             idleTimer = setTimeout(() => {
                 startAutobotCountdown();
             }, 7000);
        }
    }
    
    function startAutobotCountdown() {
        autobotCountdown = 7;
        autobotCountdownDisplay.textContent = `Autobot starting in ${autobotCountdown}...`;
        autobotCountdownDisplay.style.display = 'block';
        
        countdownInterval = setInterval(() => {
            autobotCountdown--;
            if (autobotCountdown <= 0) {
                clearInterval(countdownInterval);
                autobotCountdownDisplay.style.display = 'none';
                startGame(Math.random() > 0.5, true);
            } else {
                autobotCountdownDisplay.textContent = `Autobot starting in ${autobotCountdown}...`;
            }
        }, 1000);
    }

    function stopAutobotAndShowMenu() {
        isAutobotMode = false;
        gameOver = true;
        toggleEngineSound(false);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        showStartScreen();
    }
    
    function startGame(nightMode, autobot = false) {
        gameOverReason = '';
        damageMessage = { text: '', timer: 0 };
        
        clearTimeout(idleTimer);
        clearInterval(countdownInterval);
        autobotCountdownDisplay.style.display = 'none';

        setupAudio();
        score = 0;
        health = 100;
        fuel = 100;
        gameSpeed = 3;
        gameOver = false;
        frame = 0;
        isNightMode = nightMode;
        isAutobotMode = autobot;
        player = Object.create(playerProto);
        player.y = 300;
        player.velocityY = 0;
        blueBalls = [];
        redBalls = [];
        clouds = [];
        thunderClouds = [];
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
        isAutobotMode = false;
        toggleEngineSound(false);
        
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
        // Player vs Red Balls
        redBalls.forEach((ball, index) => {
            const dist = Math.hypot(player.x + player.width / 2 - ball.x, player.y + player.height / 2 - ball.y);
            if (dist < ball.radius + player.height / 2) {
                redBalls.splice(index, 1);
                health -= 20;
                damageMessage.text = 'Hit a Red Ball!';
                damageMessage.timer = 120;
                if (!isAutobotMode) damageSound();
            }
        });
        
        // Player vs Thunder Clouds
        thunderClouds.forEach((cloud) => {
            const playerHitboxX = player.x + player.width * 0.15;
            const playerHitboxWidth = player.width * 0.7;
            const playerHitboxY = player.y + player.height * 0.15;
            const playerHitboxHeight = player.height * 0.7;

            const cloudHitboxX = cloud.x + cloud.boundingBoxOffsetX;
            const cloudHitboxY = cloud.y + cloud.boundingBoxOffsetY;

            if (playerHitboxX < cloudHitboxX + cloud.width &&
                playerHitboxX + playerHitboxWidth > cloudHitboxX &&
                playerHitboxY < cloudHitboxY + cloud.height &&
                playerHitboxY + playerHitboxHeight > cloudHitboxY) {
                
                health -= 0.5;
                if (damageMessage.timer <= 0) {
                    damageMessage.text = 'In a Thunder Cloud!';
                    damageMessage.timer = 120;
                }
                if (frame % 30 === 0 && !isAutobotMode) damageSound();
            }
        });
        
        // Player vs Blue Balls
        blueBalls.forEach((ball, index) => {
            const dist = Math.hypot(player.x + player.width / 2 - ball.x, player.y + player.height / 2 - ball.y);
            if (dist < ball.radius + player.height / 2) {
                blueBalls.splice(index, 1);
                score += 10;
                fuel = Math.min(100, fuel + 5);
                if (!isAutobotMode) collectSound();
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
            let alpha = Math.min(1, damageMessage.timer / 60);
            ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
            ctx.fillText(damageMessage.text, canvas.width - 20, canvas.height - 20);
            damageMessage.timer--;
        }
    }

    function drawDevInfo() {
        if (!isDevMode || !player) return;

        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 2;
        const playerHitboxX = player.x + player.width * 0.15;
        const playerHitboxWidth = player.width * 0.7;
        const playerHitboxY = player.y + player.height * 0.15;
        const playerHitboxHeight = player.height * 0.7;
        ctx.strokeRect(playerHitboxX, playerHitboxY, playerHitboxWidth, playerHitboxHeight);
        
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        thunderClouds.forEach(cloud => {
            const cloudHitboxX = cloud.x + cloud.boundingBoxOffsetX;
            const cloudHitboxY = cloud.y + cloud.boundingBoxOffsetY;
            ctx.strokeRect(cloudHitboxX, cloudHitboxY, cloud.width, cloud.height);
        });
    }

    function animate() {
        if (gameOver) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        handleObjectGeneration();
        updateAndDrawObjects();
        
        if (isAutobotMode) {
            runAutobotAI();
        }
        
        player.update();
        player.draw();
        
        drawDamageMessage();
        drawDevInfo();
        
        if (!isAutobotMode) {
             checkCollisions();
        } else {
             blueBalls.forEach((ball, index) => {
                const dist = Math.hypot(player.x + player.width / 2 - ball.x, player.y + player.height / 2 - ball.y);
                if (dist < ball.radius + player.height / 2) {
                    blueBalls.splice(index, 1);
                    score += 10;
                    fuel = Math.min(100, fuel + 5);
                }
            });
        }
        
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
        bottomHelpHint.addEventListener('click', () => toggleHelpScreen(true));
        
        setupEventListeners();
        
        volumeSlider.value = currentVolume;
        muteButton.textContent = isMuted ? "Unmute" : "Mute";

        showStartScreen();
    }
    
    init();
});
