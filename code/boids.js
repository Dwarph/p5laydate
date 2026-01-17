// Boids and flocking behavior module

// Flock class to manage the array of all the boids
class Flock {
  constructor() {
    // Initialize the array of boids
    this.boids = [];
  }

  run() {
    // Get crank info once per frame for all boids
    const crankAngle = window.playdate ? window.playdate.getCrankAngle() : null;
    const crankDocked = window.playdate ? window.playdate.isCrankDocked() : true;
    const crankActive = window.playdate ? window.playdate.isCrankActive() : false;
    
    for (let boid of this.boids) {
      // Pass the entire list of boids, current crank angle, dock status, and activity to each boid
      boid.run(this.boids, crankAngle, crankDocked, crankActive);
    }
  }

  addBoid(b) {
    this.boids.push(b);
  }
}

class Boid {
  constructor(x, y) {
    this.acceleration = createVector(0, 0);
    this.velocity = createVector(random(-1, 1), random(-1, 1));
    this.position = createVector(x, y);
    this.size = window.settings.boidSize;

    // Maximum speed
    this.maxSpeed = window.settings.maxSpeed;

    // Maximum steering force
    this.maxForce = window.settings.maxForce;
    
    // Use varying shades of black/gray instead of colorful HSB
    // Random brightness between 0 (black) and 60 (dark gray) for charcoal effect
    const brightness = random(0, 60);
    this.color = color(brightness);
    
    // Store previous position for brush trail
    this.previousPosition = createVector(x, y);
  }

  run(boids, crankAngle, crankDocked, crankActive) {
    this.flock(boids, crankAngle, crankDocked, crankActive);
    this.update();
    this.borders();
    this.render();
  }

  applyForce(force) {
    // We could add mass here if we want: A = F / M
    this.acceleration.add(force);
  }

  // We accumulate a new acceleration each time based on three rules
  flock(boids, crankAngle, crankDocked, crankActive) {
    let separation = this.separate(boids);
    let alignment = this.align(boids);
    let cohesion = this.cohesion(boids);
    
    // Crank influence: create a subtle force in the direction of the crank
    // Only apply when crank is undocked AND actively being turned (within 0.2s)
    let crankForce = createVector(0, 0);
    
    // Ensure no influence when docked
    if (!crankDocked && crankActive && crankAngle !== null && !isNaN(crankAngle)) {
      // Crank is actively being turned - apply full influence immediately
      // Convert crank angle (degrees, 0-360) to radians
      // Playdate crank: 0° is at 3 o'clock, increases clockwise
      // p5.js: 0 radians is at 3 o'clock, increases counter-clockwise
      // So we need to negate and adjust: -radians(crankAngle) + PI/2
      let angle = -radians(crankAngle) + PI / 2;
      crankForce = createVector(cos(angle), sin(angle));
      // Use settings from GUI - full strength when active
      crankForce.mult(window.settings.crankInfluenceStrength);
    }
    // If docked or not active (quiet for 0.2s), no influence - crankForce stays (0, 0)

    // Use weights from settings
    separation.mult(window.settings.separationWeight);
    alignment.mult(window.settings.alignmentWeight);
    cohesion.mult(window.settings.cohesionWeight);

    // Add the force vectors to acceleration
    this.applyForce(separation);
    this.applyForce(alignment);
    this.applyForce(cohesion);
    this.applyForce(crankForce);
  }

  // Method to update location
  update() {
    // Update settings from GUI
    this.maxSpeed = window.settings.maxSpeed;
    this.maxForce = window.settings.maxForce;
    this.size = window.settings.boidSize;
    
    // Store previous position before updating
    this.previousPosition.set(this.position.x, this.position.y);
    
    // Update velocity
    this.velocity.add(this.acceleration);

    // Limit speed
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);

    // Reset acceleration to 0 each cycle
    this.acceleration.mult(0);
  }

  // A method that calculates and applies a steering force towards a target
  // STEER = DESIRED MINUS VELOCITY
  seek(target) {
    // A vector pointing from the location to the target
    let desired = p5.Vector.sub(target, this.position);

    // Normalize desired and scale to maximum speed
    desired.normalize();
    desired.mult(this.maxSpeed);

    // Steering = Desired minus Velocity
    let steer = p5.Vector.sub(desired, this.velocity);

    // Limit to maximum steering force
    steer.limit(this.maxForce);
    return steer;
  }

  render() {
    // Draw boid as a custom charcoal/graphite-style stroke
    this.drawBrushStroke();
  }
  
  drawBrushStroke() {
    // Get color components (grayscale)
    const gray = red(this.color); // Since it's grayscale, r=g=b
    const a = window.settings.brushOpacity / 255;
    
    // Calculate direction of movement
    let theta = this.velocity.heading();
    
    // Draw a small stroke in the direction of movement
    const strokeLen = window.settings.strokeLength * this.size;
    const endX = this.position.x + cos(theta) * strokeLen;
    const endY = this.position.y + sin(theta) * strokeLen;
    
    // Optimized brush effect: fewer layers and segments for performance
    noFill();
    
    const baseWeight = window.settings.brushWeight;
    
    // Use cached noise offset (calculate once per boid)
    const noiseOffset = (this.position.x * 0.01 + this.position.y * 0.01) % 1000;
    
    // Reduced layers for performance (2 instead of 4)
    const numLayers = 2;
    const numSegments = Math.max(4, Math.floor(strokeLen / 2)); // Fewer segments
    
    // Fixed texture amount for organic variation
    const textureAmount = 0.8;
    
    for (let layer = 0; layer < numLayers; layer++) {
      const layerOpacity = a * (0.3 + layer * 0.35);
      const layerWeight = baseWeight * (0.6 + layer * 0.4);
      
      stroke(gray, gray, gray, layerOpacity * 255);
      strokeWeight(layerWeight);
      
      // Draw segmented line with noise (optimized)
      beginShape();
      noFill();
      
      for (let i = 0; i <= numSegments; i++) {
        const t = i / numSegments;
        let px = lerp(this.position.x, endX, t);
        let py = lerp(this.position.y, endY, t);
        
        // Simplified noise calculation (fewer calls)
        const noiseVal = noise(noiseOffset + t * 10 + layer * 0.5);
        const noiseOffsetX = (noiseVal - 0.5) * textureAmount * 3;
        const noiseOffsetY = (noise(noiseOffset + t * 10 + 50 + layer * 0.5) - 0.5) * textureAmount * 3;
        
        // Add minimal jitter for texture
        px += noiseOffsetX + (random() - 0.5) * textureAmount * 0.5;
        py += noiseOffsetY + (random() - 0.5) * textureAmount * 0.5;
        
        vertex(px, py);
      }
      
      endShape();
    }
    
    // Reduced particles for performance
    const numParticles = Math.floor(strokeLen / 4);
    for (let i = 0; i < numParticles; i++) {
      if (random() > 0.7) { // Higher threshold to draw fewer
        const t = random();
        let px = lerp(this.position.x, endX, t);
        let py = lerp(this.position.y, endY, t);
        
        px += (random() - 0.5) * textureAmount * 1.5;
        py += (random() - 0.5) * textureAmount * 1.5;
        
        const particleSize = random(0.2, 0.8);
        const particleOpacity = a * random(0.2, 0.35);
        fill(gray, gray, gray, particleOpacity * 255);
        noStroke();
        ellipse(px, py, particleSize);
      }
    }
  }

  // Wraparound
  borders() {
    if (this.position.x < -this.size) {
      this.position.x = width + this.size;
    }

    if (this.position.y < -this.size) {
      this.position.y = height + this.size;
    }

    if (this.position.x > width + this.size) {
      this.position.x = -this.size;
    }

    if (this.position.y > height + this.size) {
      this.position.y = -this.size;
    }
  }

  // Separation
  // Method checks for nearby boids and steers away
  separate(boids) {
    let desiredSeparation = window.settings.desiredSeparation;
    let steer = createVector(0, 0);
    let count = 0;

    // For every boid in the system, check if it's too close
    for (let boid of boids) {
      let distanceToNeighbor = p5.Vector.dist(this.position, boid.position);

      // If the distance is greater than 0 and less than an arbitrary amount (0 when you are yourself)
      if (distanceToNeighbor > 0 && distanceToNeighbor < desiredSeparation) {
        // Calculate vector pointing away from neighbor
        let diff = p5.Vector.sub(this.position, boid.position);
        diff.normalize();

        // Scale by distance
        diff.div(distanceToNeighbor);
        steer.add(diff);

        // Keep track of how many
        count++;
      }
    }

    // Average -- divide by how many
    if (count > 0) {
      steer.div(count);
    }

    // As long as the vector is greater than 0
    if (steer.mag() > 0) {
      // Implement Reynolds: Steering = Desired - Velocity
      steer.normalize();
      steer.mult(this.maxSpeed);
      steer.sub(this.velocity);
      steer.limit(this.maxForce);
    }
    return steer;
  }

  // Alignment
  // For every nearby boid in the system, calculate the average velocity
  align(boids) {
    let neighborDistance = window.settings.neighborDistance;
    let sum = createVector(0, 0);
    let count = 0;
    for (let i = 0; i < boids.length; i++) {
      let d = p5.Vector.dist(this.position, boids[i].position);
      if (d > 0 && d < neighborDistance) {
        sum.add(boids[i].velocity);
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxSpeed);
      let steer = p5.Vector.sub(sum, this.velocity);
      steer.limit(this.maxForce);
      return steer;
    } else {
      return createVector(0, 0);
    }
  }

  // Cohesion
  // For the average location (i.e., center) of all nearby boids, calculate steering vector towards that location
  cohesion(boids) {
    let neighborDistance = window.settings.neighborDistance;
    let sum = createVector(0, 0); // Start with empty vector to accumulate all locations
    let count = 0;
    for (let i = 0; i < boids.length; i++) {
      let d = p5.Vector.dist(this.position, boids[i].position);
      if (d > 0 && d < neighborDistance) {
        sum.add(boids[i].position); // Add location
        count++;
      }
    }
    if (count > 0) {
      sum.div(count);
      return this.seek(sum); // Steer towards the location
    } else {
      return createVector(0, 0);
    }
  }
} // class Boid

// Expose classes to global scope
window.Flock = Flock;
window.Boid = Boid;
