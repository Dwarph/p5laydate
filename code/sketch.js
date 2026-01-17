// Main p5.js sketch - coordinates between stages

// Global state
let flock;
let gradientBuffer;
let finalBackgroundBuffer = null; // Saved background for stage 3
let currentStage = 1; // 1 = connect, 2 = configure gradient, 3 = spawn boids

// Expose to window for stage modules
window.flock = flock;
window.gradientBuffer = gradientBuffer;
window.currentStage = currentStage;

// Function to set stage (called from playdate.js)
function setStage(stage) {
  console.log('setStage called with stage:', stage);
  currentStage = stage;
  window.currentStage = stage;
  
  if (stage === 2) {
    // Initialize stage 2
    if (window.stage2 && window.stage2.initialize) {
      window.stage2.initialize();
    }
  } else if (stage === 3) {
    console.log('Stage 3 initialized, flock:', !!flock);
    // Initialize stage 3
    if (window.stage3 && window.stage3.initialize) {
      window.stage3.initialize();
    }
  }
  
  // Update UI visibility
  if (window.stage1 && window.stage1.updateConnectionUI) {
    window.stage1.updateConnectionUI();
  }
}

window.setStage = setStage;

function setup() {
  // Use 2D canvas - p5.brush should work in 2D
  createCanvas(1920, 1080);
  
  // Set up connect button (HTML element created in index.html)
  const connectButton = document.getElementById('connect-button');
  if (connectButton) {
    connectButton.addEventListener('click', connectToPlaydate);
  }
  
  // Show connection UI initially
  if (window.stage1 && window.stage1.updateConnectionUI) {
    window.stage1.updateConnectionUI();
  }

  // Don't initialize flock yet - wait for stage 3
  flock = null;
  window.flock = null;

  // Setup GUI controls
  setupGUI();
  
  // Set up Playdate button press callback
  if (window.playdate && window.playdate.setButtonPressCallback) {
    window.playdate.setButtonPressCallback(handleButtonPress);
  }
  
  // Set up Playdate controls update handler
  if (window.playdate && window.playdate.setControlsUpdateCallback) {
    window.playdate.setControlsUpdateCallback(handleControlsUpdate);
  }

  describe(
    'A group of bird-like objects, represented by brush strokes, moving across the canvas, modeling flocking behavior.'
  );
}

function handleButtonPress() {
  // Only spawn boids in stage 3
  console.log('Button pressed, current stage:', currentStage);
  if (currentStage === 3 && flock) {
    console.log('Spawning boid at center');
    createBoidAtCenter();
  } else {
    console.log('Not spawning - stage:', currentStage, 'flock exists:', !!flock);
  }
}

// Expose to global scope so playdate.js can access it after connection
window.handleButtonPress = handleButtonPress;
window.handleControlsUpdate = handleControlsUpdate;

function handleControlsUpdate(state) {
  // Route to appropriate stage handler
  if (currentStage === 2 && window.stage2 && window.stage2.handleControls) {
    window.stage2.handleControls(state);
  } else if (currentStage === 3 && window.stage3 && window.stage3.handleControls) {
    window.stage3.handleControls(state);
  } else {
    // Debug: log if no handler is found
    if (currentStage === 3) {
      console.log('Stage 3 but no handler - stage3 exists:', !!window.stage3, 'handleControls exists:', !!(window.stage3 && window.stage3.handleControls));
    }
  }
}

function initializeFlock() {
  flock = new Flock();
  window.flock = flock;
  
  // Add an initial set of boids into the system
  for (let i = 0; i < 100; i++) {
    let b = new Boid(width / 2, height / 2);
    flock.addBoid(b);
  }
}

window.initializeFlock = initializeFlock;

// Function to render a single gradient to a buffer
function renderGradientToBuffer(buffer, gradient, bufferWidth, bufferHeight, useAlphaChannel = false) {
  const color = window.GRADIENT_COLORS[gradient.colorIndex];
  const centerX = bufferWidth * gradient.centerX;
  const centerY = bufferHeight * gradient.centerY;
  const baseRadius = dist(0, 0, bufferWidth / 2, bufferHeight / 2);
  const maxRadius = baseRadius * gradient.size;
  
  const pixels = buffer.pixels;
  const noiseScale = 0.1;
  const noiseStrength = 0.3;
  
  // Use the outer color as the base color for the gradient (blue for blue, yellow for yellow, etc.)
  // This makes each gradient type visible with its characteristic color
  const baseR = color.outer.r;
  const baseG = color.outer.g;
  const baseB = color.outer.b;
  
  // Calculate bounding box to optimize performance - only process pixels near the gradient
  const minX = max(0, floor(centerX - maxRadius));
  const maxX = min(bufferWidth - 1, ceil(centerX + maxRadius));
  const minY = max(0, floor(centerY - maxRadius));
  const maxY = min(bufferHeight - 1, ceil(centerY + maxRadius));
  const maxRadiusSq = maxRadius * maxRadius;
  
  for (let y = minY; y <= maxY; y++) {
    const yOffset = y * bufferWidth;
    const dy = y - centerY;
    const dySq = dy * dy;
    
    for (let x = minX; x <= maxX; x++) {
      const dx = x - centerX;
      const dSq = dx * dx + dySq;
      
      // Skip if outside radius (using squared distance for performance)
      if (dSq > maxRadiusSq) {
        continue;
      }
      
      const d = sqrt(dSq);
      const normalizedDist = d / maxRadius;
      
      // Add noise for variation
      const noiseVal = noise(x * noiseScale, y * noiseScale);
      const noiseOffset = (noiseVal - 0.5) * noiseStrength;
      const noisyDist = constrain(normalizedDist + noiseOffset, 0, 1);
      
      // Alpha fades from 1.0 (center) to 0.0 (edge) - same color throughout, just transparency changes
      const alpha = 1.0 - noisyDist;
      
      // Skip if alpha is too low (performance optimization)
      if (alpha < 0.01) {
        continue;
      }
      
      // Blend with existing pixel using alpha
      const index = (x + yOffset) * 4;
      const existingR = pixels[index];
      const existingG = pixels[index + 1];
      const existingB = pixels[index + 2];
      const existingA = pixels[index + 3] / 255.0; // Normalize existing alpha
      
      if (useAlphaChannel) {
        // For preview buffer: use proper alpha compositing
        // If existing is transparent, just use new color
        if (existingA === 0) {
          pixels[index] = baseR;
          pixels[index + 1] = baseG;
          pixels[index + 2] = baseB;
          pixels[index + 3] = alpha * 255;
        } else {
          // Alpha compositing: new over existing
          const newAlpha = alpha + existingA * (1 - alpha);
          if (newAlpha > 0.001) {
            const blendR = (baseR * alpha + existingR * existingA * (1 - alpha)) / newAlpha;
            const blendG = (baseG * alpha + existingG * existingA * (1 - alpha)) / newAlpha;
            const blendB = (baseB * alpha + existingB * existingA * (1 - alpha)) / newAlpha;
            
            pixels[index] = blendR;
            pixels[index + 1] = blendG;
            pixels[index + 2] = blendB;
            pixels[index + 3] = newAlpha * 255;
          }
        }
      } else {
        // For main buffer: simple alpha blend (existing has opaque background)
        pixels[index] = lerp(existingR, baseR, alpha);
        pixels[index + 1] = lerp(existingG, baseG, alpha);
        pixels[index + 2] = lerp(existingB, baseB, alpha);
        pixels[index + 3] = 255;
      }
    }
  }
}

function createGradientBuffer() {
  // Create off-screen graphics buffer for gradient at lower resolution for performance
  const bufferWidth = 640; // ~1/3 resolution
  const bufferHeight = 360; // ~1/3 resolution
  
  // Remove old buffer if it exists
  if (gradientBuffer) {
    try {
      gradientBuffer.remove();
    } catch (e) {
      // Ignore errors if already removed
    }
  }
  
  gradientBuffer = createGraphics(bufferWidth, bufferHeight);
  window.gradientBuffer = gradientBuffer;
  
  // Start with base background color (off-white)
  gradientBuffer.background(253, 235, 184);
  gradientBuffer.loadPixels();
  
  // Get placed gradients from stage 2
  const placedGradients = window.getPlacedGradients ? window.getPlacedGradients() : [];
  
  // Render all placed gradients
  for (let gradient of placedGradients) {
    renderGradientToBuffer(gradientBuffer, gradient, bufferWidth, bufferHeight);
  }
  
  gradientBuffer.updatePixels();
  
  // Always save a copy for stage 3 (will be used when transitioning)
  // This ensures we have the final background ready
  if (finalBackgroundBuffer) {
    try {
      finalBackgroundBuffer.remove();
    } catch (e) {
      // Ignore errors
    }
  }
  finalBackgroundBuffer = createGraphics(bufferWidth, bufferHeight);
  finalBackgroundBuffer.copy(gradientBuffer, 0, 0, bufferWidth, bufferHeight, 0, 0, bufferWidth, bufferHeight);
}

// Track last placed gradient count to optimize updates
let lastPlacedGradientCount = 0;
let previewUpdateThrottle = 0;
const PREVIEW_UPDATE_THROTTLE_MS = 33; // ~30fps max update rate for preview
let lastPreviewGradient = null; // Cache preview to avoid re-rendering when unchanged

// Function to add a single gradient to the existing buffer (incremental update)
function addGradientToBuffer(gradient) {
  if (!gradientBuffer || window.currentStage !== 2) return;
  
  const bufferWidth = 640;
  const bufferHeight = 360;
  
  // Ensure buffer is loaded
  if (!gradientBuffer.pixels || gradientBuffer.pixels.length === 0) {
    gradientBuffer.loadPixels();
  }
  
  // Render just this new gradient
  renderGradientToBuffer(gradientBuffer, gradient, bufferWidth, bufferHeight);
  gradientBuffer.updatePixels();
}

// Function to update gradient preview (for stage 2)
function updateGradientPreview(forceFullRender = false) {
  if (window.currentStage !== 2) return;
  
  const bufferWidth = 640;
  const bufferHeight = 360;
  
  const placedGradients = window.getPlacedGradients ? window.getPlacedGradients() : [];
  const currentPlacedCount = placedGradients.length;
  
  // If we have new gradients, only render the new ones incrementally
  if (!forceFullRender && currentPlacedCount > lastPlacedGradientCount && gradientBuffer) {
    // Just add the new gradients
    for (let i = lastPlacedGradientCount; i < currentPlacedCount; i++) {
      addGradientToBuffer(placedGradients[i]);
    }
    lastPlacedGradientCount = currentPlacedCount;
  } else {
    // Full re-render (for initialization or forced updates)
    if (gradientBuffer) {
      try {
        gradientBuffer.remove();
      } catch (e) {
        // Ignore errors
      }
    }
    
    gradientBuffer = createGraphics(bufferWidth, bufferHeight);
    window.gradientBuffer = gradientBuffer;
    
    // Start with base background
    gradientBuffer.background(253, 235, 184);
    gradientBuffer.loadPixels();
    
    // Render all placed gradients
    for (let gradient of placedGradients) {
      renderGradientToBuffer(gradientBuffer, gradient, bufferWidth, bufferHeight);
    }
    
    lastPlacedGradientCount = currentPlacedCount;
    gradientBuffer.updatePixels();
  }
  
  // Note: Preview gradient is now rendered directly in draw() for better performance
  // and correct transparency handling
}

window.updateGradientPreview = updateGradientPreview;

// Function to reset gradient count tracking
function resetGradientCount() {
  lastPlacedGradientCount = 0;
}

window.resetGradientCount = resetGradientCount;

// Function to reset preview cache
function resetPreviewCache() {
  lastPreviewGradient = null;
  previewUpdateThrottle = 0;
}

window.resetPreviewCache = resetPreviewCache;

window.createGradientBuffer = createGradientBuffer;

function createBoidAtCenter() {
  if (flock) {
    flock.addBoid(new Boid(width / 2, height / 2));
  }
}

function createBoidAtPosition(normalizedX, normalizedY) {
  if (flock) {
    const x = width * normalizedX;
    const y = height * normalizedY;
    flock.addBoid(new Boid(x, y));
  }
}

window.createBoidAtCenter = createBoidAtCenter;
window.createBoidAtPosition = createBoidAtPosition;

function draw() {
  // In stage 3, draw saved background (fast - just image copy, computation already done)
  if (currentStage === 3) {
    if (finalBackgroundBuffer) {
      image(finalBackgroundBuffer, 0, 0, width, height);
    } else if (gradientBuffer) {
      // Fallback: use gradientBuffer if finalBackgroundBuffer not set
      image(gradientBuffer, 0, 0, width, height);
    } else {
      background('#fdebb8');
    }
  } else {
    // Stage 2: draw placed gradients buffer
    if (gradientBuffer) {
      image(gradientBuffer, 0, 0, width, height);
    } else {
      background('#fdebb8');
    }
    
    // Draw preview gradient directly on canvas (optimized with throttling)
    if (window.stage2 && window.currentStage === 2) {
      const now = millis();
      const bufferWidth = 640;
      const bufferHeight = 360;
      
      const currentGradient = {
        centerX: window.stage2.currentGradientCenterX || 0.5,
        centerY: window.stage2.currentGradientCenterY || 0.5,
        size: window.stage2.currentGradientSize || 1.0,
        colorIndex: window.stage2.currentGradientIndex || 0
      };
      
      // Check if preview changed
      const previewChanged = !lastPreviewGradient || 
        lastPreviewGradient.centerX !== currentGradient.centerX ||
        lastPreviewGradient.centerY !== currentGradient.centerY ||
        lastPreviewGradient.size !== currentGradient.size ||
        lastPreviewGradient.colorIndex !== currentGradient.colorIndex;
      
      // Throttle preview updates and only update if changed
      if (previewChanged && (now - previewUpdateThrottle) >= PREVIEW_UPDATE_THROTTLE_MS) {
        // Create preview buffer with transparent background
        if (window.previewBuffer) {
          window.previewBuffer.remove();
        }
        window.previewBuffer = createGraphics(bufferWidth, bufferHeight);
        window.previewBuffer.loadPixels();
        
        // Initialize all pixels to transparent (0,0,0,0)
        const pixels = window.previewBuffer.pixels;
        for (let i = 0; i < pixels.length; i += 4) {
          pixels[i] = 0;     // R
          pixels[i + 1] = 0; // G
          pixels[i + 2] = 0; // B
          pixels[i + 3] = 0; // A (transparent)
        }
        window.previewBuffer.updatePixels();
        window.previewBuffer.loadPixels(); // Reload after clearing
        
        // Render preview gradient with alpha channel support (for transparency)
        renderGradientToBuffer(window.previewBuffer, currentGradient, bufferWidth, bufferHeight, true);
        window.previewBuffer.updatePixels();
        
        lastPreviewGradient = { ...currentGradient };
        previewUpdateThrottle = now;
      }
      
      // Draw cached preview buffer with proper alpha blending
      if (window.previewBuffer) {
        push();
        blendMode(BLEND);
        image(window.previewBuffer, 0, 0, width, height);
        pop();
      }
    }
  }
  
  // Show stage instructions
  drawStageInstructions();
  
  // Only run flock in stage 3
  if (currentStage === 3) {
    if (flock) {
      flock.run();
      // Draw spawn indicator
      if (window.stage3 && window.stage3.drawSpawnIndicator) {
        window.stage3.drawSpawnIndicator();
      }
    } else {
      // Debug: log if stage 3 but no flock
      if (frameCount % 60 === 0) { // Log once per second
        console.log('Stage 3 active but no flock - flock:', !!flock);
      }
    }
  }
}

function drawStageInstructions() {
  // Route to appropriate stage's instruction drawer
  if (currentStage === 1 && window.stage1 && window.stage1.drawInstructions) {
    window.stage1.drawInstructions();
  } else if (currentStage === 2 && window.stage2 && window.stage2.drawInstructions) {
    window.stage2.drawInstructions();
  } else if (currentStage === 3 && window.stage3 && window.stage3.drawInstructions) {
    window.stage3.drawInstructions();
  } else {
    // Fallback: hide overlays
    const stageOverlay = document.getElementById('stage-overlay');
    const progressOverlay = document.getElementById('progress-overlay');
    if (stageOverlay) stageOverlay.style.display = 'none';
    if (progressOverlay) progressOverlay.style.display = 'none';
  }
}

// On mouse drag, add a new boid to the flock
function mouseDragged() {
  if (flock) {
    flock.addBoid(new Boid(mouseX, mouseY));
  }
}
