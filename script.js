(function(){
  // get all the elements we need
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestScoreEl = document.getElementById('best-score');
  const messageEl = document.getElementById('message');
  const restartBtn = document.getElementById('restart');
  const mobileHint = document.getElementById('mobile-hint');
  const musicToggle = document.getElementById('music-toggle');

  const birdImg = document.getElementById('birdSprite');
  const birdImgOut = document.getElementById('birdSpriteOut');
  const sndStart = document.getElementById('sndStart');
  const sndPass = document.getElementById('sndPass');
  const sndOut = document.getElementById('sndOut');
  const bgMusic = document.getElementById('bgMusic');

  let W, H;
  let scale = 1;
  let musicEnabled = true;

  // Game state
  let state = 'idle'; // idle | running | over
  let score = 0;
  let bestScore = parseInt(localStorage.getItem('flappyRajiniBest') || '0');
  let frame = 0;

  // game settings - made it easier to play
  const gravity = 0.25;
  const flapVelocity = -6;
  const maxFall = 8; 
  const pipeGap = 200;
  const pipeDistance = 400; // increased spacing between pipes
  const pipeSpeed = 2;

  // Visual effects
  let particles = [];
  let clouds = [];
  let groundOffset = 0;

  // Bird object with smooth animation
  const bird = {
    x: 0, // Will be set dynamically
    y: 0,
    r: 0, // Will be set dynamically
    vy: 0,
    sprite: birdImg,
    rotation: 0,
    targetRotation: 0,
    scale: 1,
    targetScale: 1
  };

  let pipes = [];

  // simple particle effect
  class Particle {
    constructor(x, y, vx, vy, color, life) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.life = life;
      this.maxLife = life;
      this.size = Math.random() * 4 + 2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.1; // gravity
      this.life--;
      this.vx *= 0.99;
    }

    draw() {
      const alpha = this.life / this.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // cloud background effect
  class Cloud {
    constructor() {
      this.x = W + 100;
      this.y = Math.random() * H * 0.4 + 50;
      this.speed = Math.random() * 0.5 + 0.3;
      this.scale = Math.random() * 0.8 + 0.5;
      this.opacity = Math.random() * 0.3 + 0.2;
    }

    update() {
      this.x -= this.speed;
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = '#ffffff';
      const size = 40 * this.scale;
      
      // draw cloud shape
      ctx.beginPath();
      ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
      ctx.arc(this.x + size * 0.7, this.y, size * 0.7, 0, Math.PI * 2);
      ctx.arc(this.x - size * 0.7, this.y, size * 0.7, 0, Math.PI * 2);
      ctx.arc(this.x, this.y - size * 0.5, size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function initializeGame() {
    updateBestScore();
    resize();
    reset();
    
    // Initialize clouds
    clouds = [];
    for(let i = 0; i < 5; i++) {
      const cloud = new Cloud();
      cloud.x = Math.random() * W;
      clouds.push(cloud);
    }
  }

  function resize() {
    const container = document.getElementById('game-wrapper');
    const rect = container.getBoundingClientRect();
    
    // Use full viewport
    W = window.innerWidth;
    H = window.innerHeight;
    
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    // Update bird position and size based on screen
    bird.x = W * 0.25; // 25% from left
    bird.r = Math.min(W, H) * 0.025; // Responsive size
    
    // Update responsive elements
    if (bird.y === 0) bird.y = H / 2;
  }

  function reset(){
    score = 0;
    frame = 0;
    bird.y = H / 2;
    bird.vy = 0;
    bird.sprite = birdImg;
    bird.rotation = 0;
    bird.targetRotation = 0;
    bird.scale = 1;
    bird.targetScale = 1;
    pipes = [];
    particles = [];
    groundOffset = 0;
    spawnPipe();
    updateScore();
    state = 'idle';
    messageEl.textContent = 'Tap to Start Flying!';
    restartBtn.classList.add('hidden');
    mobileHint.classList.remove('hidden');
  }

  function start(){
    if(state === 'running') return;
    state = 'running';
    messageEl.textContent = '';
    mobileHint.classList.add('hidden');
    
    // play start sound
    playSafe(sndStart);
    
    // start background music if enabled
    if(musicEnabled && bgMusic) {
      bgMusic.volume = 0.15; // low volume for background
      playSafe(bgMusic);
    }
    
    // add start particles
    addParticles(bird.x, bird.y, '#ffd700', 15);
  }

  function gameOver(){
    if(state === 'over') return;
    state = 'over';
    bird.sprite = birdImgOut;
    bird.targetScale = 1.2;
    playSafe(sndOut);
    
    // stop background music
    if(bgMusic) {
      try { bgMusic.pause(); } catch(e) {}
    }
    
    // update best score
    if(score > bestScore) {
      bestScore = score;
      localStorage.setItem('flappyRajiniBest', bestScore.toString());
      updateBestScore();
      addParticles(bird.x, bird.y, '#ffd700', 30); // celebration particles
    }
    
    messageEl.textContent = score > bestScore - 1 ? 'New Best!' : 'Game Over';
    restartBtn.classList.remove('hidden');
    mobileHint.classList.remove('hidden');
    
    // add crash particles
    addParticles(bird.x, bird.y, '#ff4444', 20);
  }

  function spawnPipe(){
    const margin = H * 0.15; // 15% margin from top/bottom
    const gapCenter = margin + Math.random() * (H - 2 * margin);
    const topHeight = gapCenter - pipeGap / 2;
    const bottomY = gapCenter + pipeGap / 2;
    
    pipes.push({
      x: W + 10,
      top: topHeight,
      bottom: bottomY,
      passed: false,
      width: W * 0.08 // Responsive pipe width
    });
  }

  function updatePipes(){
    for(let p of pipes){
      p.x -= pipeSpeed;
    }
    
    // Remove offscreen pipes
    if(pipes.length && pipes[0].x < -pipes[0].width * 2){
      pipes.shift();
    }
    
    // Add new pipe
    const last = pipes[pipes.length - 1];
    if(last && last.x < W - pipeDistance){
      spawnPipe();
    }
  }

  function updateBird(){
    // basic bird physics
    bird.vy += gravity;
    if(bird.vy > maxFall) bird.vy = maxFall;
    bird.y += bird.vy;

    // rotate bird based on velocity
    bird.targetRotation = Math.max(-0.5, Math.min(bird.vy * 0.1, 0.8));
    bird.rotation += (bird.targetRotation - bird.rotation) * 0.1;

    // scale animation
    bird.scale += (bird.targetScale - bird.scale) * 0.1;

    // add some particle trail when flying
    if(state === 'running' && frame % 3 === 0) {
      addParticles(bird.x - bird.r, bird.y, '#87CEEB', 2);
    }
  }

  function flap(){
    if(state === 'idle') start();
    if(state !== 'running') return;
    
    bird.vy = flapVelocity;
    bird.targetScale = 1.3;
    bird.targetRotation = -0.5;
    
    // Add flap particles
    addParticles(bird.x, bird.y + bird.r, '#ffffff', 8);
    
    setTimeout(() => bird.targetScale = 1, 100);
  }

  function collide(){
    const groundHeight = H * 0.12;
    // check if bird hits ceiling or ground
    if(bird.y - bird.r < 0 || bird.y + bird.r > H - groundHeight){
      return true;
    }
    
    // check pipe collisions
    for(const p of pipes){
      if(bird.x + bird.r > p.x && bird.x - bird.r < p.x + p.width){
        if(bird.y - bird.r < p.top || bird.y + bird.r > p.bottom){
          return true;
        }
      }
    }
    return false;
  }

  function checkScore(){
    for(const p of pipes){
      if(!p.passed && p.x + p.width < bird.x - bird.r){
        p.passed = true;
        score++;
        updateScore();
        playSafe(sndPass);
        
        // Add score particles
        addParticles(bird.x, bird.y, '#00ff88', 12);
      }
    }
  }

  function addParticles(x, y, color, count) {
    for(let i = 0; i < count; i++) {
      particles.push(new Particle(
        x + (Math.random() - 0.5) * 20,
        y + (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        color,
        30 + Math.random() * 20
      ));
    }
  }

  function updateParticles() {
    for(let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      if(particles[i].life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function updateClouds() {
    // Update existing clouds
    for(let i = clouds.length - 1; i >= 0; i--) {
      clouds[i].update();
      if(clouds[i].x < -100) {
        clouds.splice(i, 1);
      }
    }
    
    // Add new clouds
    if(Math.random() < 0.005) {
      clouds.push(new Cloud());
    }
  }

  function updateScore(){
    scoreEl.textContent = score;
  }

  function updateBestScore(){
    bestScoreEl.textContent = `Best: ${bestScore}`;
  }

  function playSafe(audio){
    if(!audio) return;
    try { 
      audio.currentTime = 0; 
      if(audio === bgMusic) {
        audio.volume = 0.15; // background music low volume
      } else {
        audio.volume = 0.4; // sound effects normal volume
      }
      audio.play(); 
    } catch(e) { /* ignore */ }
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    musicToggle.textContent = musicEnabled ? 'Music: ON' : 'Music: OFF';
    musicToggle.classList.toggle('muted', !musicEnabled);
    
    if(!musicEnabled && bgMusic) {
      try { bgMusic.pause(); } catch(e) {}
    } else if(musicEnabled && state === 'running' && bgMusic) {
      playSafe(bgMusic);
    }
  }

  function drawBackground(){
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.7, '#4facf7');
    gradient.addColorStop(1, '#2563eb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Draw clouds
    clouds.forEach(cloud => cloud.draw());

    // Animated ground
    groundOffset = (groundOffset + 1) % 40;
    const groundHeight = H * 0.12;
    
    // Ground gradient
    const groundGradient = ctx.createLinearGradient(0, H - groundHeight, 0, H);
    groundGradient.addColorStop(0, '#22c55e');
    groundGradient.addColorStop(0.5, '#16a34a');
    groundGradient.addColorStop(1, '#15803d');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, H - groundHeight, W, groundHeight);

    // Ground texture
    ctx.fillStyle = '#166534';
    for(let i = -1; i < W / 40 + 1; i++) {
      const x = i * 40 - groundOffset;
      ctx.fillRect(x, H - groundHeight + 20, 20, groundHeight - 20);
    }
  }

  function drawPipes(){
    pipes.forEach(p => {
      // Pipe gradient
      const pipeGradient = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
      pipeGradient.addColorStop(0, '#059669');
      pipeGradient.addColorStop(0.5, '#047857');
      pipeGradient.addColorStop(1, '#065f46');
      
      ctx.fillStyle = pipeGradient;
      ctx.strokeStyle = '#022c22';
      ctx.lineWidth = 3;
      
      // Top pipe
      ctx.fillRect(p.x, 0, p.width, p.top);
      ctx.strokeRect(p.x, 0, p.width, p.top);
      
      // Bottom pipe
      ctx.fillRect(p.x, p.bottom, p.width, H - p.bottom);
      ctx.strokeRect(p.x, p.bottom, p.width, H - p.bottom);
      
      // Pipe caps
      const capHeight = p.width * 0.3;
      const capWidth = p.width * 1.2;
      const capOffset = (capWidth - p.width) / 2;
      
      ctx.fillStyle = '#047857';
      ctx.fillRect(p.x - capOffset, p.top - capHeight, capWidth, capHeight);
      ctx.fillRect(p.x - capOffset, p.bottom, capWidth, capHeight);
      ctx.strokeRect(p.x - capOffset, p.top - capHeight, capWidth, capHeight);
      ctx.strokeRect(p.x - capOffset, p.bottom, capWidth, capHeight);
    });
  }

  function drawBird(){
    const img = bird.sprite;
    const size = bird.r * 2 * bird.scale;
    
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);
    
    // Bird shadow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(2, 8, size/2, size/3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalAlpha = 1;
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(particle => particle.draw());
  }

  function loop(){
    requestAnimationFrame(loop);
    frame++;

    if(state === 'running'){
      updateBird();
      updatePipes();
      checkScore();
      if(collide()) gameOver();
    }

    updateParticles();
    updateClouds();

    // Draw everything
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawPipes();
    drawBird();
    drawParticles();
  }

  function onPress(e){
    e?.preventDefault?.();
    if(state === 'over') return;
    flap();
  }

  // Input handlers
  window.addEventListener('keydown', e => {
    if(['Space', 'ArrowUp', 'KeyW'].includes(e.code)){ 
      e.preventDefault(); 
      onPress(); 
    }
    if(e.code === 'Enter' && state === 'over'){ 
      reset(); 
    }
  });

  // Touch and mouse events
  canvas.addEventListener('pointerdown', onPress);
  canvas.addEventListener('touchstart', onPress);
  canvas.addEventListener('click', onPress);
  
  restartBtn.addEventListener('click', reset);
  musicToggle.addEventListener('click', toggleMusic);

  // prevent context menu on long press
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Resize handling
  window.addEventListener('resize', () => {
    setTimeout(resize, 100); // Debounce resize
  });

  // Prevent zoom on double tap
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
  });

  // Initialize game
  initializeGame();
  loop();
})();
