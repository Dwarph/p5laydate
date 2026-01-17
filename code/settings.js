// Global settings object shared across all modules
window.settings = {
  separationWeight: 1.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  maxSpeed: 3,
  maxForce: 0.05,
  desiredSeparation: 25.0,
  neighborDistance: 50,
  crankInfluenceStrength: 0.08, // Increased default for more noticeable influence
  boidSize: 3.0,
  // Custom brush settings (simulated charcoal/graphite effect)
  brushWeight: 1.5,
  brushOpacity: 255,
  strokeLength: 8,
  // Gradient settings
  gradientSize: 1.0, // 0-1, controls radius
  gradientCenterX: 0.5, // 0-1, normalized center position
  gradientCenterY: 0.5
};
