// Main p5.js sketch

let flock;

function setup() {
  createCanvas(1920, 1080);
  createP('Drag the mouse to generate new boids.');
  createP('Connect your Playdate and click the button below to start.');

  // Add connect button
  let connectButton = createButton('Connect Playdate');
  connectButton.mousePressed(connectToPlaydate);

  flock = new Flock();

  // Add an initial set of boids into the system
  for (let i = 0; i < 100; i++) {
    let b = new Boid(width / 2, height / 2);
    flock.addBoid(b);
  }

  // Setup GUI controls
  setupGUI();
  
  // Set up Playdate button press callback
  if (window.playdate && window.playdate.setButtonPressCallback) {
    window.playdate.setButtonPressCallback(createBoidAtCenter);
  }

  describe(
    'A group of bird-like objects, represented by triangles, moving across the canvas, modeling flocking behavior.'
  );
}

function createBoidAtCenter() {
  if (flock) {
    flock.addBoid(new Boid(width / 2, height / 2));
  }
}

function draw() {
  background(0);
  flock.run();
}

// On mouse drag, add a new boid to the flock
function mouseDragged() {
  flock.addBoid(new Boid(mouseX, mouseY));
}
