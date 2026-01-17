// Boids and flocking behavior module

// Flock class to manage the array of all the boids
class Flock {
  constructor() {
    // Initialize the array of boids
    this.boids = [];
  }

  run() {
    for (let boid of this.boids) {
      // Pass the entire list of boids, current crank angle, and dock status to each boid
      const crankAngle = window.playdate ? window.playdate.getCrankAngle() : null;
      const crankDocked = window.playdate ? window.playdate.isCrankDocked() : true;
      boid.run(this.boids, crankAngle, crankDocked);
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
    colorMode(HSB);
    this.color = color(random(256), 255, 255);
  }

  run(boids, crankAngle, crankDocked) {
    this.flock(boids, crankAngle, crankDocked);
    this.update();
    this.borders();
    this.render();
  }

  applyForce(force) {
    // We could add mass here if we want: A = F / M
    this.acceleration.add(force);
  }

  // We accumulate a new acceleration each time based on three rules
  flock(boids, crankAngle, crankDocked) {
    let separation = this.separate(boids);
    let alignment = this.align(boids);
    let cohesion = this.cohesion(boids);
    
    // Crank influence: create a subtle force in the direction of the crank
    // Only apply when crank is undocked
    let crankForce = createVector(0, 0);
    if (!crankDocked && crankAngle !== null && !isNaN(crankAngle)) {
      // Convert crank angle (degrees, 0-360) to radians
      // Playdate crank: 0° is at 3 o'clock, increases clockwise
      // p5.js: 0 radians is at 3 o'clock, increases counter-clockwise
      // So we need to negate and adjust: -radians(crankAngle) + PI/2
      let angle = -radians(crankAngle) + PI / 2;
      crankForce = createVector(cos(angle), sin(angle));
      // Use settings from GUI
      crankForce.mult(window.settings.crankInfluenceStrength);
    }

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
    // Draw a triangle rotated in the direction of velocity
    let theta = this.velocity.heading() + radians(90);
    fill(this.color);
    stroke(255);
    push();
    translate(this.position.x, this.position.y);
    rotate(theta);
    beginShape();
    vertex(0, -this.size * 2);
    vertex(-this.size, this.size * 2);
    vertex(this.size, this.size * 2);
    endShape(CLOSE);
    pop();
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
