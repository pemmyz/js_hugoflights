window.addEventListener('load', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;

    // UI Elements
    const scoreElement = document.getElementById('score');
    const fuelElement = document.getElementById('fuel');
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreElement = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');

    // Game Variables
    let score = 0;
    let fuel = 100;
    let gameSpeed = 3;
    let gameOver = false;
    let frame = 0;

    // Player
    const player = {
        x: 100,
        y: 300,
        width: 80,
        height: 40,
        velocityY: 0,
        thrust: -0.2,
        gravity: 0.1,
        isThrusting: false
    };

    // Arrays for game objects
    let blueBalls = [];
    let redBalls = [];
    let clouds = [];
    let thunderClouds = [];

    // --- INPUT HANDLING ---
    window.addEventListener('keydown', function(e) {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            player.isThrusting = true;
        }
    });

    window.addEventListener('keyup', function(e) {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            player.isThrusting = false;
        }
    });
    
    restartButton.addEventListener('click', function() {
        resetGame();
    });


    // --- DRAWING FUNCTIONS ---
    function drawPlayer() {
        ctx.fillStyle = '#C0C0C0'; // Silver for body
        // Main Fuselage
        ctx.fillRect(player.x, player.y, player.width, player.height);
        
        // Cockpit
        ctx.fillStyle = '#87CEEB'; // Light blue
        ctx.beginPath();
        ctx.arc(player.x + player.width - 15, player.y + 15, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.stroke();

        // Wings
        ctx.fillStyle = '#A9A9A9'; // Darker silver
        ctx.fillRect(player.x + 20, player.y - 15, 15, player.height + 30); // Main wing
        
        // Tail
        ctx.fillRect(player.x - 10, player.y + 10, 10, 20); // Tail fin
        ctx.fillRect(player.x - 15, player.y + 10, 20, 10); // Horizontal stabilizer
        
        // Propeller (animated)
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        const propellerX = player.x + player.width + 5;
        const propellerY = player.y + player.height / 2;
        ctx.moveTo(propellerX, propellerY);
        ctx.arc(propellerX, propellerY, 15, frame * 0.3, frame * 0.3 + 1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(propellerX, propellerY);
        ctx.arc(propellerX, propellerY, 15, frame * 0.3 + Math.PI, frame * 0.3 + Math.PI + 1);
        ctx.fill();
    }

    // --- OBJECT CLASSES ---
    class Ball {
        constructor(x, y, radius, color) {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.color = color;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        update() {
            this.x -= gameSpeed;
        }
    }

    class Cloud {
        constructor(x, y, isThunder = false) {
            this.x = x;
            this.y = y;
            this.isThunder = isThunder;
            this.puffs = [];
            this.width = 0;
            this.height = 0;
            
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
            this.width = maxX - minX;
            this.height = maxY - minY;
        }
        
        draw() {
            this.puffs.forEach(puff => {
                ctx.fillStyle = this.isThunder ? 'rgba(80, 80, 90, 0.8)' : 'rgba(255, 255, 255, 0.7)';
                ctx.beginPath();
                ctx.arc(this.x + puff.x, this.y + puff.y, puff.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            if (this.isThunder && Math.random() < 0.05) { // 5% chance of lightning per frame
                this.drawLightning();
            }
        }
        
        drawLightning() {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 3;
            ctx.beginPath();
            const startX = this.x + (Math.random() - 0.5) * 50;
            const startY = this.y + this.height / 2 - 20;
            ctx.moveTo(startX, startY);
            for (let i = 1; i <= 5; i++) {
                const lx = startX + (Math.random() - 0.5) * 40;
                const ly = startY + i * 20;
                ctx.lineTo(lx, ly);
            }
            ctx.stroke();
            ctx.lineWidth = 1;
        }

        update() {
            this.x -= gameSpeed * (this.isThunder ? 0.6 : 0.4); // Slower clouds
        }
    }

    // --- OBJECT HANDLING ---
    function handleObjects() {
        // Clouds
        if (frame % 150 === 0) clouds.push(new Cloud(canvas.width + 100, Math.random() * canvas.height * 0.8));
        if (frame % 350 === 0) thunderClouds.push(new Cloud(canvas.width + 200, Math.random() * canvas.height * 0.8, true));
        
        // Balls
        if (frame % 70 === 0) blueBalls.push(new Ball(canvas.width + 20, Math.random() * canvas.height, 10, 'blue'));
        if (frame % 100 === 0) redBalls.push(new Ball(canvas.width + 20, Math.random() * canvas.height, 12, 'red'));

        [...clouds, ...thunderClouds, ...blueBalls, ...redBalls].forEach(obj => {
            obj.update();
            obj.draw();
        });

        // Remove off-screen objects
        clouds = clouds.filter(c => c.x + c.width > 0);
        thunderClouds = thunderClouds.filter(c => c.x + c.width > 0);
        blueBalls = blueBalls.filter(b => b.x + b.radius > 0);
        redBalls = redBalls.filter(b => b.x + b.radius > 0);
    }
    
    // --- COLLISION DETECTION ---
    function checkCollisions() {
        // Player vs Red Balls
        redBalls.forEach(ball => {
            const dist = Math.hypot(player.x + player.width / 2 - ball.x, player.y + player.height / 2 - ball.y);
            if (dist < ball.radius + player.height / 2) {
                endGame();
            }
        });
        
        // Player vs Thunder Clouds (simple bounding box)
        thunderClouds.forEach(cloud => {
            if (player.x < cloud.x + cloud.width &&
                player.x + player.width > cloud.x &&
                player.y < cloud.y + cloud.height &&
                player.y + player.height > cloud.y) {
                endGame();
            }
        });

        // Player vs Blue Balls
        blueBalls.forEach((ball, index) => {
            const dist = Math.hypot(player.x + player.width / 2 - ball.x, player.y + player.height / 2 - ball.y);
            if (dist < ball.radius + player.height / 2) {
                blueBalls.splice(index, 1);
                score += 10;
                fuel = Math.min(100, fuel + 5);
            }
        });
    }

    // --- PLAYER AND GAME STATE UPDATES ---
    function updatePlayer() {
        if (player.isThrusting) {
            player.velocityY += player.thrust;
        }
        player.velocityY += player.gravity;
        player.y += player.velocityY;

        // Prevent player from going off screen
        if (player.y < 0) {
            player.y = 0;
            player.velocityY = 0;
        }
        if (player.y > canvas.height - player.height) {
            player.y = canvas.height - player.height;
            player.velocityY = 0;
        }
    }
    
    function updateGameStatus() {
        // Fuel depletion
        fuel -= 0.05;
        if (fuel <= 0) {
            fuel = 0;
            endGame();
        }

        // Update UI
        scoreElement.textContent = `Score: ${score}`;
        fuelElement.textContent = `Fuel: ${Math.ceil(fuel)}`;
    }
    
    // --- GAME LOOP AND STATE MANAGEMENT ---
    function resetGame() {
        score = 0;
        fuel = 100;
        gameOver = false;
        frame = 0;
        player.y = 300;
        player.velocityY = 0;
        blueBalls = [];
        redBalls = [];
        clouds = [];
        thunderClouds = [];
        
        gameOverScreen.style.display = 'none';
        animate();
    }
    
    function endGame() {
        gameOver = true;
        finalScoreElement.textContent = score;
        gameOverScreen.style.display = 'block';
    }

    function animate() {
        if (gameOver) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        handleObjects();
        updatePlayer();
        drawPlayer();
        checkCollisions();
        updateGameStatus();
        
        frame++;
        requestAnimationFrame(animate);
    }
    
    // Start the game
    resetGame();
});
