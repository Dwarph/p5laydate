// Playdate input handling module

let playdateDevice = null;
let previousButtonStates = {};
let currentCrankAngle = null;
let isCrankDocked = true; // Start as docked
let isPollingControls = false;
let pdUsbModule = null;

// Expose these to global scope for other modules
window.playdate = {
  getCrankAngle: () => currentCrankAngle,
  isCrankDocked: () => isCrankDocked,
  isConnected: () => playdateDevice !== null,
  // Internal setters for direct updates from sketch.js
  _setCrankAngle: (angle) => { currentCrankAngle = angle; },
  _setCrankDocked: (docked) => { isCrankDocked = docked; }
};

// Callback for when a button is pressed (set by main sketch)
let onButtonPressCallback = null;

function setButtonPressCallback(callback) {
  onButtonPressCallback = callback;
}

window.playdate.setButtonPressCallback = setButtonPressCallback;

async function connectToPlaydate() {
  try {
    // Dynamically import pd-usb if not already loaded
    if (!pdUsbModule) {
      pdUsbModule = await import('https://unpkg.com/pd-usb?module');
    }
    
    playdateDevice = await pdUsbModule.requestConnectPlaydate();
    console.log('Connected to Playdate!', playdateDevice);
    
    // Debug: Check device structure
    console.log('Device properties:', Object.keys(playdateDevice));
    if (playdateDevice.serial) {
      console.log('Serial object:', playdateDevice.serial);
      console.log('Serial isOpen:', playdateDevice.serial.isOpen);
      
      // Try to open serial if it exists and isn't open
      if (playdateDevice.serial.open && typeof playdateDevice.serial.open === 'function') {
        if (!playdateDevice.serial.isOpen) {
          console.log('Attempting to open serial...');
          await playdateDevice.serial.open();
          console.log('Serial opened successfully');
        } else {
          console.log('Serial already open');
        }
      }
    }
    
    // Set up event handlers before starting polling
    playdateDevice.on('controls:update', handleControlsUpdate);
    playdateDevice.on('disconnect', () => {
      console.log('Playdate disconnected');
      playdateDevice = null;
      isPollingControls = false;
    });
    
    // Verify we can communicate by getting version info first
    // This ensures the connection is fully established and serial is open
    try {
      const version = await playdateDevice.getVersion();
      console.log('Playdate version:', version);
    } catch (e) {
      console.error('Could not get version:', e);
      // This might fail if serial isn't open, but let's continue
    }
    
    // Now start polling controls
    await playdateDevice.startPollingControls();
    isPollingControls = true;
    console.log('Started polling controls');
    
    // Set up callbacks after connection is established
    if (window.playdate && window.playdate.setButtonPressCallback && window.handleButtonPress) {
      window.playdate.setButtonPressCallback(window.handleButtonPress);
      console.log('Button press callback set after connection');
    }
    if (window.playdate && window.playdate.setControlsUpdateCallback && window.handleControlsUpdate) {
      window.playdate.setControlsUpdateCallback(window.handleControlsUpdate);
      console.log('Controls update callback set after connection');
    }
    
    // Move to stage 2 after successful connection
    if (window.setStage) {
      window.setStage(2);
    }
  } catch (error) {
    console.error('Failed to connect to Playdate:', error);
    alert('Failed to connect to Playdate: ' + error.message + '\n\nMake sure it is connected via USB and unlocked.');
    playdateDevice = null;
  }
}

function handleControlsUpdate(state) {
  // Call the main sketch's controls update handler if set
  if (onControlsUpdateCallback) {
    onControlsUpdateCallback(state);
  }
  
  // Check for button presses (for stage 3 boid spawning)
  const buttons = ['a', 'b', 'up', 'down', 'left', 'right', 'menu', 'lock'];
  
  for (let button of buttons) {
    // Check both buttonDown and pressed properties
    const isPressed = (state.buttonDown && state.buttonDown[button]) || 
                      (state.pressed && state.pressed[button]) || false;
    const wasPressed = previousButtonStates[button] || false;
    
    // Detect new button press (transition from not pressed to pressed)
    if (isPressed && !wasPressed && onButtonPressCallback) {
      console.log('Button press detected:', button);
      onButtonPressCallback();
    }
    
    previousButtonStates[button] = isPressed;
  }
  
  // Update current crank angle and dock status (used to influence boid direction)
  // This should work in all stages, including stage 3
  // Check multiple possible property names for crank angle
  let crankValue = state.crank;
  if (crankValue === undefined || crankValue === null) {
    // Try alternative property names
    crankValue = state.crankAngle;
  }
  if (crankValue === undefined || crankValue === null) {
    crankValue = state.crankValue;
  }
  
  // Check for explicit dock status first (most reliable)
  let explicitDocked = undefined;
  if (state.crankDocked !== undefined) {
    explicitDocked = state.crankDocked;
  } else if (state.isCrankDocked !== undefined) {
    explicitDocked = state.isCrankDocked;
  }
  
  // Update crank angle if we have a valid value
  if (crankValue !== undefined && crankValue !== null && !isNaN(crankValue)) {
    const oldAngle = currentCrankAngle;
    currentCrankAngle = crankValue;
    // If we have a crank angle, it's definitely undocked
    isCrankDocked = false;
    
    // Log every crank update to debug
    if (oldAngle !== currentCrankAngle) {
      console.log('Crank angle updated:', currentCrankAngle, 'State:', {
        crank: state.crank,
        crankAngle: state.crankAngle,
        crankValue: state.crankValue,
        crankDocked: state.crankDocked,
        isCrankDocked: state.isCrankDocked,
        stateKeys: Object.keys(state)
      });
    }
  } else {
    // No crank angle in this update
    // Only update dock status if we have explicit information
    if (explicitDocked !== undefined) {
      isCrankDocked = explicitDocked;
      // Only clear angle if explicitly docked
      if (explicitDocked === true) {
        currentCrankAngle = null;
      }
    }
    // If no explicit dock info, don't change dock status - keep last known state
    // This preserves the angle if we had one before
    
    // Log the full state structure to see what we're getting
    // Log more frequently to catch the issue
    if (Math.random() < 0.2) { // 20% chance to log
      console.log('No crank angle in state update. Full state:', state);
      console.log('State keys:', Object.keys(state));
      console.log('Current stored angle:', currentCrankAngle, 'Docked:', isCrankDocked);
      console.log('Explicit docked:', explicitDocked);
    }
  }
  
  // Debug: log dock status and angle more frequently
  if (Math.random() < 0.1) { // 10% chance to log
    console.log('Crank status check:', {
      currentCrankAngle: currentCrankAngle,
      isCrankDocked: isCrankDocked,
      stateCrank: state.crank,
      explicitDocked: explicitDocked,
      hasCrankValue: crankValue !== undefined && crankValue !== null
    });
  }
}

// Callback for controls update (set by main sketch)
let onControlsUpdateCallback = null;

function setControlsUpdateCallback(callback) {
  onControlsUpdateCallback = callback;
}

window.playdate.setControlsUpdateCallback = setControlsUpdateCallback;

// Expose connect function
window.connectToPlaydate = connectToPlaydate;
