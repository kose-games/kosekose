const FIELD_WIDTH = 6;
const FIELD_HEIGHT = 12;
const CELL_SIZE = 50;
const PUYO_COLORS = ['red', 'blue', 'green', 'yellow'];
const FALL_SPEED = 500;
const FAST_FALL_SPEED = 50;

class ImageManager {
    constructor() {
        this.images = {
            red: null,
            blue: null,
            green: null,
            yellow: null
        };
    }

    async loadAllImages() {
        const imageFiles = [
            { color: 'red', file: 'img/001.png' },
            { color: 'blue', file: 'img/002.png' },
            { color: 'green', file: 'img/003.png' },
            { color: 'yellow', file: 'img/004.png' }
        ];

        for (const { color, file } of imageFiles) {
            try {
                await this.loadImageFromPath(color, file);
                console.log(`画像 ${file} を正常に読み込みました`);
            } catch (error) {
                console.warn(`画像 ${file} が見つかりません。デフォルトの描画を使用します。`, error);
            }
        }
    }

    loadImageFromPath(color, path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images[color] = img;
                resolve(img);
            };
            img.onerror = () => {
                reject(new Error(`Failed to load image: ${path}`));
            };
            img.src = path;
        });
    }

    getImage(color) {
        return this.images[color];
    }
}

class Puyo {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
    }

    draw(ctx, offsetX = 0, offsetY = 0, imageManager = null, useCustomImages = true, scale = 1) {
        const cellSize = CELL_SIZE * scale;
        const centerX = (this.x + 0.5) * cellSize + offsetX;
        const centerY = (this.y + 0.5) * cellSize + offsetY;
        
        const image = imageManager && useCustomImages ? imageManager.getImage(this.color) : null;
        
        if (image) {
            const size = cellSize * 0.8;
            try {
                ctx.drawImage(
                    image,
                    centerX - size / 2,
                    centerY - size / 2,
                    size,
                    size
                );
            } catch (e) {
                console.error('画像描画エラー:', e);
            }
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(centerX, centerY, cellSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 2 * scale;
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(centerX - cellSize * 0.1, centerY - cellSize * 0.1, cellSize * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class PuyoPair {
    constructor(game) {
        this.game = game;
        this.mainPuyo = new Puyo(2, 0, this.getRandomColor());
        this.subPuyo = new Puyo(2, -1, this.getRandomColor());
        this.rotation = 0;
    }

    getRandomColor() {
        const colorCount = this.game ? this.game.colorCount : 4;
        return PUYO_COLORS[Math.floor(Math.random() * colorCount)];
    }

    rotate(direction, field) {
        const oldRotation = this.rotation;
        const oldSubX = this.subPuyo.x;
        const oldSubY = this.subPuyo.y;

        this.rotation = (this.rotation + direction + 4) % 4;
        
        switch (this.rotation) {
            case 0:
                this.subPuyo.x = this.mainPuyo.x;
                this.subPuyo.y = this.mainPuyo.y - 1;
                break;
            case 1:
                this.subPuyo.x = this.mainPuyo.x + 1;
                this.subPuyo.y = this.mainPuyo.y;
                break;
            case 2:
                this.subPuyo.x = this.mainPuyo.x;
                this.subPuyo.y = this.mainPuyo.y + 1;
                break;
            case 3:
                this.subPuyo.x = this.mainPuyo.x - 1;
                this.subPuyo.y = this.mainPuyo.y;
                break;
        }

        if (!this.canMove(0, 0, field)) {
            this.rotation = oldRotation;
            this.subPuyo.x = oldSubX;
            this.subPuyo.y = oldSubY;
            return false;
        }
        return true;
    }

    move(dx, dy, field) {
        if (this.canMove(dx, dy, field)) {
            this.mainPuyo.x += dx;
            this.mainPuyo.y += dy;
            this.subPuyo.x += dx;
            this.subPuyo.y += dy;
            return true;
        }
        return false;
    }

    canMove(dx, dy, field) {
        const newMainX = this.mainPuyo.x + dx;
        const newMainY = this.mainPuyo.y + dy;
        const newSubX = this.subPuyo.x + dx;
        const newSubY = this.subPuyo.y + dy;

        if (newMainX < 0 || newMainX >= FIELD_WIDTH || newMainY >= FIELD_HEIGHT) {
            return false;
        }
        if (newSubX < 0 || newSubX >= FIELD_WIDTH || newSubY >= FIELD_HEIGHT) {
            return false;
        }

        if (newMainY >= 0 && field[newMainY][newMainX]) {
            return false;
        }
        if (newSubY >= 0 && field[newSubY][newSubX]) {
            return false;
        }

        return true;
    }

    draw(ctx, imageManager = null, useCustomImages = true, scale = 1) {
        this.mainPuyo.draw(ctx, 0, 0, imageManager, useCustomImages, scale);
        this.subPuyo.draw(ctx, 0, 0, imageManager, useCustomImages, scale);
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        this.field = Array(FIELD_HEIGHT).fill(null).map(() => Array(FIELD_WIDTH).fill(null));
        this.currentPair = null;
        this.nextPair = null;
        this.score = 0;
        this.gameOver = false;
        this.isPaused = true;
        this.lastFallTime = 0;
        this.fallSpeed = FALL_SPEED;
        this.chainCount = 0;
        this.isProcessingChain = false;
        this.imageManager = new ImageManager();
        this.soundEffects = null; // 後で初期化
        this.colorCount = 4; // デフォルトは4色
        this.useCustomImages = false; // デフォルトは画像を使用しない
        this.isMobile = this.checkIfMobile();
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
    }

    async init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.createNextPair();
        this.spawnNewPair();
        this.draw();
        
        // モバイルの場合はコントローラーを表示
        if (this.isMobile) {
            document.getElementById('mobileControls').classList.remove('hidden');
        }
        
        // 画像を非同期で読み込み、完了後に再描画
        this.imageManager.loadAllImages().then(() => {
            console.log('すべての画像の読み込みが完了しました');
            this.draw();
            // ゲームループが動いていない場合も描画を更新
            if (this.isPaused) {
                setTimeout(() => this.draw(), 100);
            }
        });
    }
    
    checkIfMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || window.innerWidth <= 768;
    }
    
    setupCanvas() {
        // モバイルでのキャンバスサイズ調整
        if (this.isMobile) {
            const resizeCanvas = () => {
                const maxWidth = Math.min(window.innerWidth * 0.9, 300);
                const scale = maxWidth / 300;
                this.canvas.style.width = maxWidth + 'px';
                this.canvas.style.height = (600 * scale) + 'px';
            };
            
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            window.addEventListener('orientationchange', resizeCanvas);
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // タッチイベントの設定
        if (this.isMobile) {
            this.setupTouchEvents();
            this.setupMobileButtons();
        }
    }
    
    setupTouchEvents() {
        const canvas = this.canvas;
        
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.touchStartTime = Date.now();
        }, { passive: false });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.gameOver || this.isProcessingChain) return;
            
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;
            const deltaTime = Date.now() - this.touchStartTime;
            
            // タップ判定（移動量が小さく、時間が短い）
            if (Math.abs(deltaX) < 30 && Math.abs(deltaY) < 30 && deltaTime < 300) {
                // キャンバスの中心より左側をタップしたら左回転、右側なら右回転
                const rect = canvas.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                if (touch.clientX < centerX) {
                    this.currentPair.rotate(-1, this.field);
                } else {
                    this.currentPair.rotate(1, this.field);
                }
            }
            // スワイプ判定
            else if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // 横スワイプ
                if (deltaX > 50) {
                    this.currentPair.move(1, 0, this.field);
                } else if (deltaX < -50) {
                    this.currentPair.move(-1, 0, this.field);
                }
            } else {
                // 縦スワイプ
                if (deltaY > 50) {
                    this.fallSpeed = FAST_FALL_SPEED;
                } else if (deltaY < -50) {
                    this.hardDrop();
                }
            }
            
            this.draw();
        }, { passive: false });
        
        // ダブルタップで一時停止
        let lastTap = 0;
        canvas.addEventListener('touchstart', (e) => {
            const currentTime = Date.now();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
                e.preventDefault();
                this.togglePause();
            }
            lastTap = currentTime;
        });
    }
    
    setupMobileButtons() {
        // 仮想ボタンのイベント設定
        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');
        const btnDown = document.getElementById('btnDown');
        const btnRotateLeft = document.getElementById('btnRotateLeft');
        const btnRotateRight = document.getElementById('btnRotateRight');
        const btnHardDrop = document.getElementById('btnHardDrop');
        const btnPause = document.getElementById('btnPause');
        
        // 移動ボタン
        btnLeft.addEventListener('click', () => {
            if (!this.gameOver && !this.isPaused && !this.isProcessingChain) {
                this.currentPair.move(-1, 0, this.field);
                this.draw();
            }
        });
        
        btnRight.addEventListener('click', () => {
            if (!this.gameOver && !this.isPaused && !this.isProcessingChain) {
                this.currentPair.move(1, 0, this.field);
                this.draw();
            }
        });
        
        // 落下ボタン
        let downInterval;
        btnDown.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.isPaused && !this.isProcessingChain) {
                this.fallSpeed = FAST_FALL_SPEED;
                // 押し続けている間は高速落下を維持
                downInterval = setInterval(() => {
                    this.fallSpeed = FAST_FALL_SPEED;
                }, 50);
            }
        });
        
        btnDown.addEventListener('touchend', (e) => {
            e.preventDefault();
            clearInterval(downInterval);
            this.fallSpeed = FALL_SPEED;
        });
        
        btnDown.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            clearInterval(downInterval);
            this.fallSpeed = FALL_SPEED;
        });
        
        // 回転ボタン
        btnRotateLeft.addEventListener('click', () => {
            if (!this.gameOver && !this.isPaused && !this.isProcessingChain) {
                this.currentPair.rotate(-1, this.field);
                this.draw();
            }
        });
        
        btnRotateRight.addEventListener('click', () => {
            if (!this.gameOver && !this.isPaused && !this.isProcessingChain) {
                this.currentPair.rotate(1, this.field);
                this.draw();
            }
        });
        
        // ハードドロップボタン
        btnHardDrop.addEventListener('click', () => {
            if (!this.gameOver && !this.isPaused && !this.isProcessingChain) {
                this.hardDrop();
            }
        });
        
        // 一時停止ボタン
        btnPause.addEventListener('click', () => {
            if (!this.gameOver) {
                this.togglePause();
                const pauseIcon = btnPause.querySelector('.pause-icon');
                const playIcon = btnPause.querySelector('.play-icon');
                if (this.isPaused) {
                    pauseIcon.classList.add('hidden');
                    playIcon.classList.remove('hidden');
                } else {
                    pauseIcon.classList.remove('hidden');
                    playIcon.classList.add('hidden');
                }
            }
        });
        
        // 初期状態でプレイボタンを表示
        const pauseIcon = btnPause.querySelector('.pause-icon');
        const playIcon = btnPause.querySelector('.play-icon');
        pauseIcon.classList.add('hidden');
        playIcon.classList.remove('hidden');
    }

    handleKeyPress(e) {
        // Xキーは常に一時停止
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            if (!this.gameOver) {
                this.togglePause();
            }
            return;
        }

        // スペースキーの処理
        if (e.key === ' ') {
            e.preventDefault();
            // ゲーム開始前ならスタート
            if (this.isPaused && !this.gameOver) {
                this.togglePause();
                return;
            }
            // ゲーム中なら右回転
            if (!this.gameOver && !this.isPaused && !this.isProcessingChain) {
                this.currentPair.rotate(1, this.field);
                this.draw();
            }
            return;
        }

        if (this.gameOver || this.isPaused || this.isProcessingChain) return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.currentPair.move(-1, 0, this.field);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.currentPair.move(1, 0, this.field);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.fallSpeed = FAST_FALL_SPEED;
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.hardDrop();
                break;
            case 'z':
            case 'Z':
                e.preventDefault();
                this.currentPair.rotate(-1, this.field);
                break;
        }
        this.draw();
    }

    togglePause() {
        if (this.gameOver) return;
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            this.lastFallTime = performance.now();
            this.gameLoop();
        }
    }

    hardDrop() {
        if (!this.currentPair) return;
        
        // 落下できる最下段まで移動
        while (this.currentPair.move(0, 1, this.field)) {
            // 移動し続ける
        }
        
        // 設置処理
        this.placePuyo(this.currentPair.mainPuyo);
        this.placePuyo(this.currentPair.subPuyo);
        this.processChains();
    }

    createNextPair() {
        this.nextPair = new PuyoPair(this);
    }

    spawnNewPair() {
        this.currentPair = this.nextPair || new PuyoPair(this);
        this.createNextPair();
        this.fallSpeed = FALL_SPEED;
        
        if (!this.currentPair.canMove(0, 0, this.field)) {
            this.endGame();
        }
    }

    placePuyo(puyo) {
        if (puyo.y >= 0) {
            this.field[puyo.y][puyo.x] = puyo;
        }
    }

    dropFloatingPuyos() {
        let moved = true;
        while (moved) {
            moved = false;
            for (let y = FIELD_HEIGHT - 2; y >= 0; y--) {
                for (let x = 0; x < FIELD_WIDTH; x++) {
                    if (this.field[y][x] && !this.field[y + 1][x]) {
                        this.field[y + 1][x] = this.field[y][x];
                        this.field[y + 1][x].y = y + 1;
                        this.field[y][x] = null;
                        moved = true;
                    }
                }
            }
        }
    }

    checkChains() {
        const toRemove = [];
        const visited = Array(FIELD_HEIGHT).fill(null).map(() => Array(FIELD_WIDTH).fill(false));

        for (let y = 0; y < FIELD_HEIGHT; y++) {
            for (let x = 0; x < FIELD_WIDTH; x++) {
                if (this.field[y][x] && !visited[y][x]) {
                    const group = this.findConnectedPuyos(x, y, this.field[y][x].color, visited);
                    if (group.length >= 4) {
                        toRemove.push(...group);
                    }
                }
            }
        }

        if (toRemove.length > 0) {
            this.chainCount++;
            for (const puyo of toRemove) {
                this.field[puyo.y][puyo.x] = null;
            }
            
            const chainBonus = Math.pow(2, this.chainCount - 1);
            this.score += toRemove.length * 10 * chainBonus;
            document.getElementById('score').textContent = this.score;
            
            // 効果音を再生
            if (this.soundEffects) {
                if (this.chainCount >= 2) {
                    // 2連鎖以上の場合、連鎖数を表示と連鎖効果音を再生
                    this.showChainDisplay(this.chainCount);
                    this.soundEffects.playChainSound(this.chainCount);
                } else {
                    // 1連鎖（通常消去）の場合、消去効果音を再生
                    this.soundEffects.playEraseSound();
                }
            }
            
            return true;
        }

        this.chainCount = 0;
        return false;
    }

    findConnectedPuyos(x, y, color, visited) {
        const stack = [{x, y}];
        const group = [];

        while (stack.length > 0) {
            const {x: cx, y: cy} = stack.pop();
            
            if (cx < 0 || cx >= FIELD_WIDTH || cy < 0 || cy >= FIELD_HEIGHT) continue;
            if (visited[cy][cx]) continue;
            if (!this.field[cy][cx] || this.field[cy][cx].color !== color) continue;

            visited[cy][cx] = true;
            group.push({x: cx, y: cy});

            stack.push({x: cx + 1, y: cy});
            stack.push({x: cx - 1, y: cy});
            stack.push({x: cx, y: cy + 1});
            stack.push({x: cx, y: cy - 1});
        }

        return group;
    }

    async processChains() {
        this.isProcessingChain = true;
        
        while (true) {
            this.dropFloatingPuyos();
            await this.animateFrame(100);
            
            if (!this.checkChains()) {
                break;
            }
            
            await this.animateFrame(300);
        }
        
        this.isProcessingChain = false;
        this.spawnNewPair();
    }

    animateFrame(duration) {
        return new Promise(resolve => {
            const startTime = performance.now();
            const animate = () => {
                const elapsed = performance.now() - startTime;
                this.draw();
                if (elapsed < duration) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    update(currentTime) {
        if (this.isPaused || this.gameOver || this.isProcessingChain) return;

        if (currentTime - this.lastFallTime > this.fallSpeed) {
            if (!this.currentPair.move(0, 1, this.field)) {
                this.placePuyo(this.currentPair.mainPuyo);
                this.placePuyo(this.currentPair.subPuyo);
                this.processChains();
            }
            this.lastFallTime = currentTime;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // テーマに応じてグリッド線の色を変更
        const isLightTheme = document.body.classList.contains('light-theme');
        this.ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
        
        for (let y = 0; y <= FIELD_HEIGHT; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * CELL_SIZE);
            this.ctx.lineTo(FIELD_WIDTH * CELL_SIZE, y * CELL_SIZE);
            this.ctx.stroke();
        }
        for (let x = 0; x <= FIELD_WIDTH; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * CELL_SIZE, 0);
            this.ctx.lineTo(x * CELL_SIZE, FIELD_HEIGHT * CELL_SIZE);
            this.ctx.stroke();
        }

        for (let y = 0; y < FIELD_HEIGHT; y++) {
            for (let x = 0; x < FIELD_WIDTH; x++) {
                if (this.field[y][x]) {
                    this.field[y][x].draw(this.ctx, 0, 0, this.imageManager, this.useCustomImages);
                }
            }
        }

        if (this.currentPair && !this.isProcessingChain) {
            this.currentPair.draw(this.ctx, this.imageManager, this.useCustomImages);
        }
        
        // 置けない場所（最上段）にバツ印を表示
        this.drawForbiddenMarks();

        this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        if (this.nextPair) {
            const scale = 0.6; // ネクストパネルは60%のサイズで表示
            const tempPair = new PuyoPair(this);
            tempPair.mainPuyo = new Puyo(0.5, 1.2, this.nextPair.mainPuyo.color);
            tempPair.subPuyo = new Puyo(0.5, 0.2, this.nextPair.subPuyo.color);
            tempPair.mainPuyo.draw(this.nextCtx, 20, 10, this.imageManager, this.useCustomImages, scale);
            tempPair.subPuyo.draw(this.nextCtx, 20, 10, this.imageManager, this.useCustomImages, scale);
        }
    }

    gameLoop() {
        if (this.gameOver || this.isPaused) return;

        const currentTime = performance.now();
        this.update(currentTime);
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    endGame() {
        this.gameOver = true;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').classList.remove('hidden');
    }

    setColorCount(count) {
        this.colorCount = parseInt(count);
        this.resetGame();
    }

    resetGame() {
        // ゲームをリセット
        this.field = Array(FIELD_HEIGHT).fill(null).map(() => Array(FIELD_WIDTH).fill(null));
        this.score = 0;
        document.getElementById('score').textContent = this.score;
        this.gameOver = false;
        this.isPaused = true;
        this.chainCount = 0;
        this.isProcessingChain = false;
        document.getElementById('gameOver').classList.add('hidden');
        
        // 新しいぷよを生成
        this.createNextPair();
        this.spawnNewPair();
        this.draw();
    }

    showChainDisplay(chainCount) {
        const chainDisplay = document.getElementById('chainDisplay');
        const chainNumber = chainDisplay.querySelector('.chain-number');
        const chainText = chainDisplay.querySelector('.chain-text');
        
        chainNumber.textContent = chainCount;
        
        // 連鎖数に応じてテキストを変更
        if (chainCount >= 10) {
            chainText.textContent = '連鎖！！！';
        } else if (chainCount >= 7) {
            chainText.textContent = '連鎖！！';
        } else {
            chainText.textContent = '連鎖！';
        }
        
        // アニメーションクラスをリセット
        chainDisplay.classList.remove('hidden', 'show-chain');
        
        // 少し遅延してアニメーションを開始（CSSトランジションのため）
        setTimeout(() => {
            chainDisplay.classList.add('show-chain');
        }, 10);
        
        // 1.5秒後に非表示
        clearTimeout(this.chainDisplayTimeout);
        this.chainDisplayTimeout = setTimeout(() => {
            chainDisplay.classList.remove('show-chain');
            setTimeout(() => {
                chainDisplay.classList.add('hidden');
            }, 300);
        }, 1500);
    }
    
    drawForbiddenMarks() {
        // 左から3番目（インデックス2）の最上段に常にバツ印を表示
        const x = 2; // 左から3番目
        const centerX = (x + 0.5) * CELL_SIZE;
        const centerY = 0.5 * CELL_SIZE;
        
        // 影を先に描画
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        // 赤い太いバツ印を描画
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 6;
        this.ctx.lineCap = 'round';
        
        const size = CELL_SIZE * 0.35;
        
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - size, centerY - size);
        this.ctx.lineTo(centerX + size, centerY + size);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + size, centerY - size);
        this.ctx.lineTo(centerX - size, centerY + size);
        this.ctx.stroke();
        
        this.ctx.restore();
        
        // 白い縁取りを追加
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - size, centerY - size);
        this.ctx.lineTo(centerX + size, centerY + size);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + size, centerY - size);
        this.ctx.lineTo(centerX - size, centerY + size);
        this.ctx.stroke();
    }

}

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowDown' && game && !game.gameOver && !game.isPaused) {
        game.fallSpeed = FALL_SPEED;
    }
});

// 効果音マネージャークラス
class SoundEffectManager {
    constructor() {
        this.chainSounds = [];
        this.chainSoundPaths = [
            'audio/chain1.mp3',  // 2-3連鎖用
            'audio/chain2.mp3',  // 4-6連鎖用
            'audio/chain3.mp3'   // 7連鎖以上用
        ];
        this.eraseSoundPath = 'audio/erase.mp3';  // 通常の消去音
        this.eraseSound = null;
        this.volume = 0.7;
        this.audioContext = null;
        this.init();
    }

    async init() {
        // Web Audio APIの初期化
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio APIが利用できません');
        }
        
        // 連鎖音を事前にロード
        for (let i = 0; i < this.chainSoundPaths.length; i++) {
            const audio = new Audio();
            audio.src = this.chainSoundPaths[i];
            audio.volume = this.volume;
            
            await new Promise((resolve) => {
                audio.addEventListener('canplaythrough', () => {
                    console.log(`連鎖効果音${i + 1}を読み込みました`);
                    resolve();
                }, { once: true });
                
                audio.addEventListener('error', () => {
                    console.warn(`連鎖効果音 ${this.chainSoundPaths[i]} が見つかりません`);
                    resolve();
                }, { once: true });
            });
            
            this.chainSounds.push(audio);
        }
        
        // 通常の消去音をロード
        this.eraseSound = new Audio();
        this.eraseSound.src = this.eraseSoundPath;
        this.eraseSound.volume = this.volume;
        
        await new Promise((resolve) => {
            this.eraseSound.addEventListener('canplaythrough', () => {
                console.log('消去効果音を読み込みました');
                resolve();
            }, { once: true });
            
            this.eraseSound.addEventListener('error', () => {
                console.warn(`消去効果音 ${this.eraseSoundPath} が見つかりません`);
                resolve();
            }, { once: true });
        });
    }

    playChainSound(chainCount) {
        let soundIndex = 0;
        if (chainCount >= 7) {
            soundIndex = 2;
        } else if (chainCount >= 4) {
            soundIndex = 1;
        }

        const sound = this.chainSounds[soundIndex];
        if (sound && sound.src) {
            // 既に再生中の場合は最初から再生
            sound.currentTime = 0;
            sound.play().catch(error => {
                console.warn('連鎖効果音の再生エラー:', error);
                // ファイルが見つからない場合は生成した音を再生
                this.playSynthesizedChainSound(chainCount);
            });
        } else {
            // 音声ファイルがない場合は生成した音を再生
            this.playSynthesizedChainSound(chainCount);
        }
    }
    
    playSynthesizedChainSound(chainCount) {
        if (!this.audioContext) return;
        
        // 連鎖数に応じて複数の音を生成
        const noteCount = Math.min(chainCount, 5);
        const duration = 0.3 + (chainCount * 0.1);
        
        for (let i = 0; i < noteCount; i++) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // フィルター設定
            filter.type = 'bandpass';
            filter.frequency.value = 1000 + (i * 500);
            filter.Q.value = 5;
            
            // 音程を上昇させる（ドレミファソのような音階）
            const baseFreq = 523.25; // C5
            const freqMultiplier = Math.pow(2, (i * 2) / 12); // 全音ずつ上昇
            const startTime = this.audioContext.currentTime + (i * 0.05);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(baseFreq * freqMultiplier, startTime);
            oscillator.frequency.exponentialRampToValueAtTime(
                baseFreq * freqMultiplier * 1.5, 
                startTime + 0.1
            );
            
            // 各音の音量設定（連鎖が進むほど大きく）
            const noteVolume = this.volume * (0.6 + (chainCount * 0.05));
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(noteVolume, startTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        }
        
        // 低音の補強
        const bassOsc = this.audioContext.createOscillator();
        const bassGain = this.audioContext.createGain();
        
        bassOsc.connect(bassGain);
        bassGain.connect(this.audioContext.destination);
        
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(130.81, this.audioContext.currentTime); // C3
        bassGain.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        bassOsc.start(this.audioContext.currentTime);
        bassOsc.stop(this.audioContext.currentTime + duration);
    }

    playEraseSound() {
        // まず音声ファイルが存在する場合はそれを再生
        if (this.eraseSound && this.eraseSound.src) {
            this.eraseSound.currentTime = 0;
            this.eraseSound.play().catch(error => {
                console.warn('消去効果音の再生エラー:', error);
                // ファイルが見つからない場合は生成した音を再生
                this.playSynthesizedEraseSound();
            });
        } else {
            // 音声ファイルがない場合は生成した音を再生
            this.playSynthesizedEraseSound();
        }
    }
    
    playSynthesizedEraseSound() {
        if (!this.audioContext) return;
        
        // 複数の音を重ねてより豊かな音にする
        const oscillator1 = this.audioContext.createOscillator();
        const oscillator2 = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator1.connect(filter);
        oscillator2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // フィルター設定（高音を強調）
        filter.type = 'highpass';
        filter.frequency.value = 200;
        
        // 消去音の設定（より明るく派手な音）
        oscillator1.type = 'square';
        oscillator1.frequency.setValueAtTime(1200, this.audioContext.currentTime);
        oscillator1.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.15);
        
        oscillator2.type = 'sawtooth';
        oscillator2.frequency.setValueAtTime(2400, this.audioContext.currentTime);
        oscillator2.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.15);
        
        // より大きな音量で
        gainNode.gain.setValueAtTime(this.volume * 0.8, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        oscillator1.start(this.audioContext.currentTime);
        oscillator1.stop(this.audioContext.currentTime + 0.15);
        oscillator2.start(this.audioContext.currentTime);
        oscillator2.stop(this.audioContext.currentTime + 0.15);
    }
    
    setVolume(volume) {
        this.volume = volume / 100;
        this.chainSounds.forEach(sound => {
            sound.volume = this.volume;
        });
        if (this.eraseSound) {
            this.eraseSound.volume = this.volume;
        }
    }
}

// BGMマネージャークラス
class BGMManager {
    constructor() {
        this.audio = new Audio();
        this.audio.loop = true;
        this.audio.volume = 0.3; // BGMを控えめに
        this.isPlaying = false;
        this.bgmPath = 'audio/bgm.mp3'; // BGMファイルのパス
    }

    async init() {
        // BGMファイルが存在するかチェック
        return new Promise((resolve) => {
            this.audio.src = this.bgmPath;
            this.audio.addEventListener('canplaythrough', () => {
                console.log('BGMファイルが見つかりました');
                resolve(true);
            }, { once: true });
            
            this.audio.addEventListener('error', () => {
                console.warn('BGMファイル (audio/bgm.mp3) が見つかりません。BGM機能は使用できません。');
                resolve(false);
            }, { once: true });
        });
    }

    play() {
        if (this.audio.src && !this.isPlaying) {
            this.audio.play().then(() => {
                this.isPlaying = true;
            }).catch(error => {
                console.warn('BGM再生エラー:', error);
            });
        }
    }

    pause() {
        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
        }
    }

    setVolume(volume) {
        // BGMは効果音より控えめに（60%の音量）
        this.audio.volume = (volume / 100) * 0.6;
    }

    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
        return this.isPlaying;
    }
}

let game;
let bgmManager;
let soundEffects;

window.addEventListener('DOMContentLoaded', async () => {
    game = new Game();
    bgmManager = new BGMManager();
    soundEffects = new SoundEffectManager();
    
    // 効果音マネージャーをゲームに設定
    game.soundEffects = soundEffects;
    
    // 色数設定を読み込み
    const savedColorCount = parseInt(localStorage.getItem('colorCount')) || 4;
    game.colorCount = savedColorCount;
    document.getElementById('colors' + savedColorCount).checked = true;
    
    // 画像使用設定を読み込み
    const savedUseCustomImages = localStorage.getItem('useCustomImages') === 'true';
    game.useCustomImages = savedUseCustomImages;
    document.getElementById('useCustomImages').checked = savedUseCustomImages;
    
    // 初期表示時に背景画像を適用
    if (savedUseCustomImages) {
        document.body.classList.add('custom-background');
    }
    
    // 設定を読み込んだ後にゲームを初期化
    await game.init();
    
    // 色数変更イベントリスナー
    document.querySelectorAll('input[name="colorCount"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const newColorCount = parseInt(e.target.value);
            localStorage.setItem('colorCount', newColorCount);
            game.setColorCount(newColorCount);
        });
    });
    
    // 画像使用設定変更イベントリスナー
    document.getElementById('useCustomImages').addEventListener('change', (e) => {
        game.useCustomImages = e.target.checked;
        localStorage.setItem('useCustomImages', e.target.checked);
        
        // 背景画像の切り替え
        if (e.target.checked) {
            document.body.classList.add('custom-background');
        } else {
            document.body.classList.remove('custom-background');
        }
        
        game.draw(); // 再描画
    });
    
    const bgmAvailable = await bgmManager.init();
    
    // BGM初回確認ダイアログの処理
    const bgmConfirmShown = localStorage.getItem('bgmConfirmShown');
    if (!bgmConfirmShown && bgmAvailable) {
        const dialog = document.getElementById('bgmConfirmDialog');
        dialog.classList.remove('hidden');
        
        document.getElementById('bgmConfirmYes').addEventListener('click', () => {
            localStorage.setItem('bgmConfirmShown', 'true');
            localStorage.setItem('bgmEnabled', 'true');
            dialog.classList.add('hidden');
            // BGMを開始
            bgmManager.play();
            document.querySelector('.bgm-icon').textContent = '🔊';
            document.querySelector('.bgm-text').textContent = 'BGM ON';
        });
        
        document.getElementById('bgmConfirmNo').addEventListener('click', () => {
            localStorage.setItem('bgmConfirmShown', 'true');
            localStorage.setItem('bgmEnabled', 'false');
            dialog.classList.add('hidden');
            document.querySelector('.bgm-icon').textContent = '🔇';
            document.querySelector('.bgm-text').textContent = 'BGM OFF';
        });
    }
    
    // テーマ切り替え機能
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');
    const themeText = themeToggle.querySelector('.theme-text');
    
    // ローカルストレージから保存されたテーマを読み込む
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeIcon.textContent = '☀️';
        themeText.textContent = 'ライトモード';
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        
        if (isLight) {
            themeIcon.textContent = '☀️';
            themeText.textContent = 'ライトモード';
            localStorage.setItem('theme', 'light');
        } else {
            themeIcon.textContent = '🌙';
            themeText.textContent = 'ダークモード';
            localStorage.setItem('theme', 'dark');
        }
        
        // ゲーム画面を再描画
        if (game) {
            game.draw();
        }
    });
    
    // BGM機能
    const bgmToggle = document.getElementById('bgmToggle');
    const bgmIcon = bgmToggle.querySelector('.bgm-icon');
    const bgmText = bgmToggle.querySelector('.bgm-text');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    
    // BGMが利用可能でない場合はボタンを無効化
    if (!bgmAvailable) {
        bgmToggle.disabled = true;
        bgmIcon.textContent = '❌';
        bgmText.textContent = 'BGM利用不可';
        volumeSlider.disabled = true;
        return;
    }
    
    // ローカルストレージから保存されたBGM設定を読み込む
    const savedBgmEnabled = localStorage.getItem('bgmEnabled') === 'true';
    const savedVolume = parseInt(localStorage.getItem('bgmVolume')) || 50;
    
    volumeSlider.value = savedVolume;
    volumeValue.textContent = savedVolume + '%';
    bgmManager.setVolume(savedVolume);
    soundEffects.setVolume(savedVolume); // 効果音の初期音量も設定
    
    // 初期状態を設定（初回確認ダイアログを考慮）
    if (savedBgmEnabled && bgmConfirmShown) {
        bgmIcon.textContent = '🔊';
        bgmText.textContent = 'BGM ON';
        // ユーザー操作後に自動再生を試みる
        const startBgm = () => {
            bgmManager.play();
            if (!bgmManager.isPlaying) {
                // 再生できなかった場合、表示を更新
                bgmIcon.textContent = '🔇';
                bgmText.textContent = 'BGM OFF';
                localStorage.setItem('bgmEnabled', 'false');
            }
        };
        // ページロード時に一度試みる
        setTimeout(startBgm, 100);
        // 失敗した場合はクリックで再試行
        setTimeout(() => {
            if (!bgmManager.isPlaying && savedBgmEnabled) {
                document.addEventListener('click', startBgm, { once: true });
            }
        }, 200);
    }
    
    bgmToggle.addEventListener('click', () => {
        const isPlaying = bgmManager.toggle();
        
        if (isPlaying) {
            bgmIcon.textContent = '🔊';
            bgmText.textContent = 'BGM ON';
            localStorage.setItem('bgmEnabled', 'true');
        } else {
            bgmIcon.textContent = '🔇';
            bgmText.textContent = 'BGM OFF';
            localStorage.setItem('bgmEnabled', 'false');
        }
    });
    
    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value;
        volumeValue.textContent = volume + '%';
        bgmManager.setVolume(volume);
        soundEffects.setVolume(volume); // 効果音の音量も同時に調整
        localStorage.setItem('bgmVolume', volume);
    });
});