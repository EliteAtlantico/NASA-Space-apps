// Import Three.js core
import * as THREE from 'three';

// Import OrbitControls
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Import Howler.js
import { Howl } from 'howler';

// Create a loading manager
const loadingManager = new THREE.LoadingManager();

// Keep track of loaded sounds
let soundsLoaded = 0;
let totalSounds = 0;

// Function to check if all assets are loaded
function checkIfAllLoaded() {
  if (texturesLoaded && soundsLoaded === totalSounds) {
    // All assets are loaded
    showStartButton();
  }
}

// Variables to track texture loading
let texturesLoaded = false;

// Set up the scene
const scene = new THREE.Scene();

// Set the background of the scene to black
scene.background = new THREE.Color(0x000000);

// Set up the camera
const camera = new THREE.PerspectiveCamera(
  75, // Field of view
  window.innerWidth / window.innerHeight, // Aspect ratio
  0.1, // Near clipping plane
  1000 // Far clipping plane
);

// Position the camera
camera.position.z = 3;

// Set up the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Add ambient lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Create a spotlight and attach it to the camera
const spotLight = new THREE.SpotLight(0xffffff, 1);
spotLight.position.set(0, 0, 0);
spotLight.target.position.set(0, 0, -1); // Point the spotlight forward
camera.add(spotLight);
camera.add(spotLight.target); // Add the spotlight target to the camera
scene.add(camera); // Add the camera (with the spotlight) to the scene

// Adjust spotlight properties (optional)
spotLight.angle = Math.PI / 6;
spotLight.penumbra = 0.1;
spotLight.decay = 2;
spotLight.distance = 100;

// Load the globe texture using the loading manager
const textureLoader = new THREE.TextureLoader(loadingManager);
const globeTexture = textureLoader.load(
  '/Earth.jpg',
  () => {},
  undefined,
  (error) => {
    console.error('Error loading globe texture:', error);
  }
);

// When texture loading is complete
loadingManager.onLoad = function () {
  texturesLoaded = true;
  checkIfAllLoaded();
};

// Create the sphere geometry and material
const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
const sphereMaterial = new THREE.MeshStandardMaterial({
  map: globeTexture,
});

// Create the sphere mesh
const globe = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(globe);

// Initialize OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);

// Enable damping (inertia)
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Enable zoom and limit zoom distances
controls.enableZoom = true;
controls.minDistance = 1.5;
controls.maxDistance = 10;

// Optionally disable panning (horizontal and vertical movement)
controls.enablePan = false;

// Create an array to store interactable objects
const interactableObjects = [];

// Create a raycaster and mouse vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Variable to keep track of the currently hovered sphere
let INTERSECTED_SPHERE = null;

// Variable to keep track of the currently selected sphere
let SELECTED_SPHERE = null;

// Function to convert latitude and longitude to 3D coordinates on the globe
function latLongToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Function to create a texture with text
function createTextTexture(message) {
  const fontSize = 50;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  // Measure text width and height
  context.font = `${fontSize}px Times New Roman`;
  const metrics = context.measureText(message);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  // Set canvas size based on text dimensions
  canvas.width = textWidth;
  canvas.height = textHeight;

  // Re-apply font since canvas size was changed
  context.font = `${fontSize}px Times New Roman`;
  context.textBaseline = 'top';
  context.fillStyle = 'white';
  context.fillText(message, 0, 0);

  // Optional: Store the text content for later use
  canvas.textContent = message;

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Map to associate spheres with their labels
const sphereLabelMap = new Map();

// Function to create an interactable sphere on the globe's surface with a label and optional sounds
function createInteractableSphereOnGlobe(lat, lon, name, soundFiles = []) {
  const position = latLongToVector3(lat, lon, 1.01); // Slightly above globe surface
  const geometry = new THREE.SphereGeometry(0.0075, 32, 32); // Reduced sphere size
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(position);

  // Store the name in userData
  sphere.userData.name = name;

  // Add the sphere as a child of the globe
  globe.add(sphere);

  // Add the sphere to interactable objects array
  interactableObjects.push(sphere);

  // Create a sprite for the label
  const spriteMaterial = new THREE.SpriteMaterial({
    map: createTextTexture(name),
    transparent: true,
    depthTest: false, // Ensures the label is always visible
    opacity: 0, // Start with label invisible
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.08, 0.05, 1); // Adjust the scale as needed
  sprite.position.copy(position.clone().multiplyScalar(1.05)); // Position slightly above the sphere

  // Add the label sprite as a child of the globe
  globe.add(sprite);

  // Store the label in the map with the sphere as the key
  sphereLabelMap.set(sphere, sprite);

  // Initialize arrays to store sounds and sound data
  sphere.userData.sounds = [];
  sphere.userData.soundData = [];

  // Map volume levels to numerical values
  const volumeLevels = {
    'low': 0.03,
    'medium': 0.4,
    'high': 1.0
  };

  // If sound files are provided, load the sounds using Howler.js
  soundFiles.forEach((soundFile) => {
    const { path, volume, label } = soundFile;
    const volumeValue = volumeLevels[volume.toLowerCase()] || 0.6; // Default to medium if not specified

    // Store the label and volume in userData for display in the modal
    sphere.userData.soundData.push({ label, volume });

    if (path) {
      totalSounds++; // Increment total sounds to load

      const sound = new Howl({
        src: [path],
        loop: true,
        volume: volumeValue, // Set volume based on classification
        onload: function () {
          soundsLoaded++;
          checkIfAllLoaded();
        },
        onloaderror: function (id, error) {
          console.error('Error loading sound:', error);
          soundsLoaded++;
          checkIfAllLoaded();
        },
      });

      // **Store the original volume for later use**
      sound.originalVolume = volumeValue;

      // Add the sound and its label to the sounds array
      sphere.userData.sounds.push({ sound, label });
    }
  });
}

// Define sound file paths
const weathering = '/strings_sound.mp3';
const humidity = '/brass_sound.mp3';
const airQuality = '/woodwind_sound.mp3';

// Create multiple interactable spheres at specific latitudes and longitudes
// For each sphere, provide an array of sound files with volume levels and labels

// Kuwait City, Kuwait
createInteractableSphereOnGlobe(
  29.3759,
  47.9774,
  'Kuwait',
  [
    { path: airQuality, volume: 'High', label: 'Air Quality' },
    { path: humidity, volume: 'Medium', label: 'Humidity' },
    { path: weathering, volume: 'High', label: 'Weather Extremity' }
  ]
);

// Abu Dhabi, United Arab Emirates
createInteractableSphereOnGlobe(24.4539, 54.3773, 'UAE', [
  { path: airQuality, volume: 'High', label: 'Air Quality' },
  { path: humidity, volume: 'High', label: 'Humidity' },
  { path: weathering, volume: 'High', label: 'Weather Extremity' }
]);

// Doha, Qatar
createInteractableSphereOnGlobe(25.276987, 51.520008, 'Qatar', [
  { path: airQuality, volume: 'High', label: 'Air Quality' },
  { path: humidity, volume: 'High', label: 'Humidity' },
  { path: weathering, volume: 'High', label: 'Weather Extremity' }
]);

// Manama, Bahrain
createInteractableSphereOnGlobe(26.2285, 50.5860, 'Bahrain', [
  { path: airQuality, volume: 'High', label: 'Air Quality' },
  { path: humidity, volume: 'High', label: 'Humidity' },
  { path: weathering, volume: 'Medium', label: 'Weather Extremity' }
]);

// Muscat, Oman
createInteractableSphereOnGlobe(23.6143, 58.5450, 'Oman', [
  { path: airQuality, volume: 'Medium', label: 'Air Quality' },
  { path: humidity, volume: 'High', label: 'Humidity' },
  { path: weathering, volume: 'High', label: 'Weather Extremity' }
]);

// Riyadh, Saudi Arabia
createInteractableSphereOnGlobe(24.7136, 46.6753, 'Saudi Arabia', [
  { path: airQuality, volume: 'High', label: 'Air Quality' },
  { path: humidity, volume: 'Low', label: 'Humidity' },
  { path: weathering, volume: 'High', label: 'Weather Extremity' }
]);

// Beirut, Lebanon
createInteractableSphereOnGlobe(33.8938, 35.5018, 'Lebanon', [
  { path: airQuality, volume: 'Medium', label: 'Air Quality' },
  { path: humidity, volume: 'Medium', label: 'Humidity' },
  { path: weathering, volume: 'Medium', label: 'Weather Extremity' }
]);

// Amman, Jordan
createInteractableSphereOnGlobe(31.9516, 35.9239, 'Jordan', [
  { path: airQuality, volume: 'Low', label: 'Air Quality' },
  { path: humidity, volume: 'Low', label: 'Humidity' },
  { path: weathering, volume: 'Medium', label: 'Weather Extremity' }
]);

// Damascus, Syria
createInteractableSphereOnGlobe(33.5138, 36.2765, 'Syria', [
  { path: airQuality, volume: 'Medium', label: 'Air Quality' },
  { path: humidity, volume: 'Medium', label: 'Humidity' },
  { path: weathering, volume: 'Medium', label: 'Weather Extremity' }
]);

// Tehran, Iran
createInteractableSphereOnGlobe(35.6892, 51.3890, 'Iran', [
  { path: airQuality, volume: 'High', label: 'Air Quality' },
  { path: humidity, volume: 'Medium', label: 'Humidity' },
  { path: weathering, volume: 'High', label: 'Weather Extremity' }
]);

// Baghdad, Iraq
createInteractableSphereOnGlobe(33.3152, 44.3661, 'Iraq', [
  { path: airQuality, volume: 'High', label: 'Air Quality' },
  { path: humidity, volume: 'Medium', label: 'Humidity' },
  { path: weathering, volume: 'High', label: 'Weather Extremity' }
]);

// Jerusalem, Palestine
createInteractableSphereOnGlobe(31.7683, 35.2137, 'Palestine', [
  { path: airQuality, volume: 'Medium', label: 'Air Quality' },
  { path: humidity, volume: 'Medium', label: 'Humidity' },
  { path: weathering, volume: 'Medium', label: 'Weather Extremity' }
]);

// Sana'a, Yemen
createInteractableSphereOnGlobe(15.3694, 44.1910, "Yemen", [
  { path: airQuality, volume: 'Medium', label: 'Air Quality' },
  { path: humidity, volume: 'Low', label: 'Humidity' },
  { path: weathering, volume: 'High', label: 'Weather Extremity' }
]);

// Cairo, Egypt
createInteractableSphereOnGlobe(30.0444, 31.2357, 'Egypt', [
  { path: airQuality, volume: 'High', label: 'Air Quality' },
  { path: humidity, volume: 'Medium', label: 'Humidity' },
  { path: weathering, volume: 'Medium', label: 'Weather Extremity' }
]);

// Event listener for mouse move
window.addEventListener('mousemove', onMouseMove, false);

// Mouse move handler
function onMouseMove(event) {
  // Normalize mouse coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the raycaster
  raycaster.setFromCamera(mouse, camera);

  // Calculate objects intersecting the raycaster
  const intersects = raycaster.intersectObjects(interactableObjects, true);

  if (intersects.length > 0) {
    const intersectedSphere = intersects[0].object;

    if (INTERSECTED_SPHERE !== intersectedSphere) {
      // Hide the label of the previously intersected sphere
      if (INTERSECTED_SPHERE) {
        const prevLabel = sphereLabelMap.get(INTERSECTED_SPHERE);
        if (prevLabel) {
          prevLabel.material.opacity = 0;
        }
      }

      // Show the label of the currently intersected sphere
      const label = sphereLabelMap.get(intersectedSphere);
      if (label) {
        label.material.opacity = 1;
      }

      INTERSECTED_SPHERE = intersectedSphere;
    }
  } else {
    // Hide the label of the previously intersected sphere
    if (INTERSECTED_SPHERE) {
      const prevLabel = sphereLabelMap.get(INTERSECTED_SPHERE);
      if (prevLabel) {
        prevLabel.material.opacity = 0;
      }
      INTERSECTED_SPHERE = null;
    }
  }
}

// Variables to track the enabled state of each sound type
let airQualityEnabled = true;
let humidityEnabled = true;
let weatheringEnabled = true;

// Function to show the modal window
function showModal(sphereName, soundData) {
  // Create the modal container (overlay)
  const modal = document.createElement('div');
  modal.id = 'modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'flex-end'; // Align modal to the right
  modal.style.zIndex = '2';

  // Add event listener to close modal when clicking outside the content
  modal.addEventListener('click', function(event) {
    if (event.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // Create the modal content container
  const modalContent = document.createElement('div');
  modalContent.style.backgroundColor = '#141414';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '5px';
  modalContent.style.textAlign = 'center';
  modalContent.style.width = '30%';   // Adjust width for the right-aligned modal
  modalContent.style.maxHeight = '100%';  // Ensure it fits vertically
  modalContent.style.overflowY = 'auto';
  modalContent.style.position = 'relative';  // To position the button correctly

  // Prevent clicks inside the modal content from closing the modal
  modalContent.addEventListener('click', function(event) {
    event.stopPropagation();
  });

  // Add content to modal
  const title = document.createElement('h2');
  title.innerText = `You clicked on ${sphereName}`;
  title.style.color = '#FFFFFF';
  modalContent.appendChild(title);

  // Display the sound data (Weather Extremity, Humidity, Air Quality)
  soundData.forEach((dataItem) => {
    const { label, volume } = dataItem;
    const infoText = document.createElement('p');
    infoText.style.color = '#FFFFFF';
    infoText.style.marginTop = '10px';
    infoText.innerText = `${label}: ${volume}`;
    modalContent.appendChild(infoText);
  });

  // Create the button to open the separate .html file
  const openButton = document.createElement('button');
  openButton.innerText = 'Open Details';
  openButton.style.padding = '10px 20px';
  openButton.style.fontSize = '16px';
  openButton.style.marginTop = '20px';
  openButton.style.display = 'block';
  openButton.style.marginLeft = 'auto';
  openButton.style.marginRight = 'auto';  // Center the button
  openButton.style.color = '#FFFFFF';
  openButton.style.backgroundColor = '#141414';
  openButton.style.border = '2px solid #FFFFFF';
  openButton.style.borderRadius = '20px';
  openButton.style.outline = 'none';
  openButton.style.cursor = 'pointer';
  openButton.addEventListener('click', () => {
    // Create an iframe to display the separate .html file
    const iframe = document.createElement('iframe');
    iframe.src = '/Information.html'; // Adjust the path as needed
    iframe.style.width = '100%';
    iframe.style.height = '80vh';
    iframe.style.border = 'none';

    // Clear existing content and add iframe
    modalContent.innerHTML = '';
    modalContent.appendChild(iframe);
  });
  modalContent.appendChild(openButton);

  // Optional: Create a close button inside the modal
  const closeButton = document.createElement('button');
  closeButton.innerText = 'Close';
  closeButton.style.padding = '10px 20px';
  closeButton.style.fontSize = '16px';
  closeButton.style.marginTop = '20px';
  closeButton.style.marginLeft = 'auto';
  closeButton.style.marginRight = 'auto';  // Center the button
  closeButton.style.color = '#FFFFFF';
  closeButton.style.backgroundColor = '#141414';
  closeButton.style.border = '2px solid #FFFFFF';
  closeButton.style.borderRadius = '20px';
  closeButton.style.outline = 'none';
  closeButton.style.cursor = 'pointer';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  modalContent.appendChild(closeButton);

  // Add the modal content to the modal container
  modal.appendChild(modalContent);

  // Add the modal to the document body
  document.body.appendChild(modal);
}

// Event listener for mouse click
window.addEventListener('click', onMouseClick, false);

// Mouse click handler
function onMouseClick(event) {
  // Ignore clicks on the GUI buttons
  if (event.target.tagName === 'BUTTON') return;

  // Normalize mouse coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the raycaster
  raycaster.setFromCamera(mouse, camera);

  // Calculate objects intersecting the raycaster
  const intersects = raycaster.intersectObjects(interactableObjects, true);

  if (intersects.length > 0) {
    const intersectedSphere = intersects[0].object;

    // Deselect the previously selected sphere
    if (SELECTED_SPHERE && SELECTED_SPHERE !== intersectedSphere) {
      SELECTED_SPHERE.material.color.set(0xffffff); // Reset to original color
      // Mute all sounds by setting volume to 0
      if (SELECTED_SPHERE.userData.sounds) {
        SELECTED_SPHERE.userData.sounds.forEach(({ sound }) => {
          sound.volume(0);
          sound.stop(); // Stop the sound to reset playback position
        });
      }
    }

    // Select the new sphere
    SELECTED_SPHERE = intersectedSphere;
    SELECTED_SPHERE.material.color.set(0x00ff00); // Change color to indicate selection

    // Play sounds based on toggle states
    if (SELECTED_SPHERE.userData.sounds) {
      SELECTED_SPHERE.userData.sounds.forEach(({ sound, label }) => {
        // Set the volume based on the mute state and original volume
        let isEnabled = false;
        if (label === 'Air Quality') isEnabled = airQualityEnabled;
        else if (label === 'Humidity') isEnabled = humidityEnabled;
        else if (label === 'Weather Extremity') isEnabled = weatheringEnabled;

        const volume = isEnabled ? sound.originalVolume : 0;
        sound.volume(volume);

        if (!sound.playing()) {
          sound.play();
        }
      });
    }

    // Get the name of the sphere
    const sphereName = SELECTED_SPHERE.userData.name || 'Unknown Location';

    // Get the sound data for display
    const soundData = SELECTED_SPHERE.userData.soundData || [];

    // Show the modal window with sound data
    showModal(sphereName, soundData);
  } else {
    // Deselect the currently selected sphere if click on empty space
    if (SELECTED_SPHERE) {
      SELECTED_SPHERE.material.color.set(0xffffff); // Reset to original color
      // Mute all sounds by setting volume to 0
      if (SELECTED_SPHERE.userData.sounds) {
        SELECTED_SPHERE.userData.sounds.forEach(({ sound }) => {
          sound.volume(0);
          sound.stop(); // Stop the sound to reset playback position
        });
      }
      SELECTED_SPHERE = null;
    }
  }
}

// Variable to control globe rotation
let rotationEnabled = true;

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Rotate the globe if rotation is enabled
  if (rotationEnabled) {
    globe.rotation.y += 0.001;
  }

  // Update controls (required when enableDamping is true)
  controls.update();

  renderer.render(scene, camera);
}

// Function to start the application after loading with a manual fade-out effect
function startApplication() {
  const loadingScreen = document.getElementById('loading-screen');

  if (loadingScreen) {
    let opacity = 1;  // Start with full opacity
    const fadeInterval = setInterval(() => {
      opacity -= 0.05;  // Decrease opacity in small increments
      if (opacity <= 0) {
        clearInterval(fadeInterval);  // Stop the interval when opacity reaches 0
        document.body.removeChild(loadingScreen);  // Remove the loading screen
      } else {
        loadingScreen.style.opacity = opacity;  // Update the opacity
      }
    }, 50);  // Interval time for each opacity step (50ms = 20 steps in 1 second)
  }

  // Append the renderer's canvas to the document body
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Add the toggle buttons to the document body
  document.body.appendChild(toggleButton);
  document.body.appendChild(airQualityButton);
  document.body.appendChild(humidityButton);
  document.body.appendChild(weatheringButton);

  // Start the animation loop
  animate();
}

// Function to show the start button after assets are loaded
function showStartButton() {
  const startButton = document.createElement('button');
  startButton.innerText = 'Start';
  startButton.style.padding = '10px 20px';
  startButton.style.fontSize = '24px';
  startButton.style.marginTop = '20px';

  // Center the button
  startButton.style.display = 'block';
  startButton.style.marginLeft = 'auto';
  startButton.style.marginRight = 'auto';

  // Add click event to start the application
  startButton.addEventListener('click', startApplication);

  // Add the button to the loading screen
  const loadingContent = document.getElementById('loading-content');
  if (loadingContent) {
    loadingContent.appendChild(startButton);
  }
}

// Create the loading screen
function createLoadingScreen() {
  const loadingScreen = document.createElement('div');
  loadingScreen.id = 'loading-screen';
  loadingScreen.style.position = 'fixed';
  loadingScreen.style.top = '0';
  loadingScreen.style.left = '0';
  loadingScreen.style.width = '100%';
  loadingScreen.style.height = '100%';
  loadingScreen.style.backgroundColor = '#000000';
  loadingScreen.style.display = 'flex';
  loadingScreen.style.flexDirection = 'column';
  loadingScreen.style.alignItems = 'center';
  loadingScreen.style.justifyContent = 'center';
  loadingScreen.style.zIndex = '9999';

  const loadingContent = document.createElement('div');
  loadingContent.id = 'loading-content';
  loadingContent.style.textAlign = 'center';

  const title = document.createElement('h1');
  title.innerText = 'Symphony Simulation';
  title.style.color = '#FFFFFF';
  loadingContent.appendChild(title);

  loadingScreen.appendChild(loadingContent);
  document.body.appendChild(loadingScreen);
}

// Call the function to create the loading screen
createLoadingScreen();

// Handle window resize
window.addEventListener('resize', () => {
  // Update camera aspect ratio and projection matrix
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Create a toggle button for globe rotation
const toggleButton = document.createElement('button');
toggleButton.innerText = 'Pause Rotation';
toggleButton.style.position = 'absolute';
toggleButton.style.top = '10px';
toggleButton.style.left = '10px';
toggleButton.style.padding = '10px 20px';
toggleButton.style.fontSize = '16px';
toggleButton.style.zIndex = '1';
toggleButton.style.color = '#FFFFFF';
toggleButton.style.backgroundColor = '#141414';
toggleButton.style.border = '2px solid #FFFFFF';
toggleButton.style.borderRadius = '20px';
toggleButton.style.outline = 'none';
toggleButton.style.cursor = 'pointer';

// Add event listener to the toggle button
toggleButton.addEventListener('click', () => {
  rotationEnabled = !rotationEnabled;
  toggleButton.innerText = rotationEnabled ? 'Pause Rotation' : 'Resume Rotation';
});

// Create toggle buttons for sounds
const airQualityButton = document.createElement('button');
airQualityButton.innerText = 'Mute Air Quality';
airQualityButton.style.position = 'absolute';
airQualityButton.style.top = '10px';
airQualityButton.style.right = '10px';
airQualityButton.style.padding = '10px 20px';
airQualityButton.style.fontSize = '16px';
airQualityButton.style.zIndex = '1';
airQualityButton.style.color = '#FFFFFF';
airQualityButton.style.backgroundColor = '#141414';
airQualityButton.style.border = '2px solid #FFFFFF';
airQualityButton.style.borderRadius = '20px';
airQualityButton.style.outline = 'none';
airQualityButton.style.cursor = 'pointer';

// Add event listener to the air quality button
airQualityButton.addEventListener('click', () => {
  airQualityEnabled = !airQualityEnabled;
  airQualityButton.innerText = airQualityEnabled ? 'Mute Air Quality' : 'Unmute Air Quality';
  updateAllSounds('Air Quality', airQualityEnabled);
});

const humidityButton = document.createElement('button');
humidityButton.innerText = 'Mute Humidity';
humidityButton.style.position = 'absolute';
humidityButton.style.top = '50px';
humidityButton.style.right = '10px';
humidityButton.style.padding = '10px 20px';
humidityButton.style.fontSize = '16px';
humidityButton.style.zIndex = '1';
humidityButton.style.color = '#FFFFFF';
humidityButton.style.backgroundColor = '#141414';
humidityButton.style.border = '2px solid #FFFFFF';
humidityButton.style.borderRadius = '20px';
humidityButton.style.outline = 'none';
humidityButton.style.cursor = 'pointer';

// Add event listener to the humidity button
humidityButton.addEventListener('click', () => {
  humidityEnabled = !humidityEnabled;
  humidityButton.innerText = humidityEnabled ? 'Mute Humidity' : 'Unmute Humidity';
  updateAllSounds('Humidity', humidityEnabled);
});

const weatheringButton = document.createElement('button');
weatheringButton.innerText = 'Mute Weather Extremity';
weatheringButton.style.position = 'absolute';
weatheringButton.style.top = '90px';
weatheringButton.style.right = '10px';
weatheringButton.style.padding = '10px 20px';
weatheringButton.style.fontSize = '16px';
weatheringButton.style.zIndex = '1';
weatheringButton.style.color = '#FFFFFF';
weatheringButton.style.backgroundColor = '#141414';
weatheringButton.style.border = '2px solid #FFFFFF';
weatheringButton.style.borderRadius = '20px';
weatheringButton.style.outline = 'none';
weatheringButton.style.cursor = 'pointer';

// Add event listener to the weathering button
weatheringButton.addEventListener('click', () => {
  weatheringEnabled = !weatheringEnabled;
  weatheringButton.innerText = weatheringEnabled ? 'Mute Weather Extremity' : 'Unmute Weather Extremity';
  updateAllSounds('Weather Extremity', weatheringEnabled);
});

// Function to update all sounds based on toggle buttons
function updateAllSounds(label, isEnabled) {
  interactableObjects.forEach((sphere) => {
    if (sphere.userData.sounds) {
      sphere.userData.sounds.forEach(({ sound, label: soundLabel }) => {
        if (soundLabel === label) {
          // Adjust the volume instead of stopping the sound
          const volume = isEnabled ? sound.originalVolume : 0;
          sound.volume(volume);
        }
      });
    }
  });
}
