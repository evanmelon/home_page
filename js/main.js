import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, container, labelRenderer;
// let stats, gui;

// PointerLockControls setting
let controls
let moveForward = false
let moveBackward = false
let moveLeft = false
let moveRight = false
let canJump = false
let raycaster

const vertex = new THREE.Vector3();
const color = new THREE.Color();

let glScene, cssScene, glRenderer, cssRenderer;
let sky, sun;
function initSky() {

    // Add Sky
    sky = new Sky();
    sky.scale.setScalar( 450000 );
    scene.add( sky );

    sun = new THREE.Vector3();

    /// GUI

    const effectController = {
        turbidity: 10,
        rayleigh: 3,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.7,
        elevation: 2,
        azimuth: 180,
        exposure: renderer.toneMappingExposure
    };

    function guiChanged() {

        const uniforms = sky.material.uniforms;
        uniforms[ 'turbidity' ].value = effectController.turbidity;
        uniforms[ 'rayleigh' ].value = effectController.rayleigh;
        uniforms[ 'mieCoefficient' ].value = effectController.mieCoefficient;
        uniforms[ 'mieDirectionalG' ].value = effectController.mieDirectionalG;

        const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation );
        const theta = THREE.MathUtils.degToRad( effectController.azimuth );

        sun.setFromSphericalCoords( 1, phi, theta );

        uniforms[ 'sunPosition' ].value.copy( sun );

        renderer.toneMappingExposure = effectController.exposure;
        renderer.render( scene, camera );

    }

    const gui = new GUI();

    gui.add( effectController, 'turbidity', 0.0, 20.0, 0.1 ).onChange( guiChanged );
    gui.add( effectController, 'rayleigh', 0.0, 4, 0.001 ).onChange( guiChanged );
    gui.add( effectController, 'mieCoefficient', 0.0, 0.1, 0.001 ).onChange( guiChanged );
    gui.add( effectController, 'mieDirectionalG', 0.0, 1, 0.001 ).onChange( guiChanged );
    gui.add( effectController, 'elevation', 0, 90, 0.1 ).onChange( guiChanged );
    gui.add( effectController, 'azimuth', - 180, 180, 0.1 ).onChange( guiChanged );
    gui.add( effectController, 'exposure', 0, 1, 0.0001 ).onChange( guiChanged );

    guiChanged();

}

function initStats() {
    const stats = new Stats()
    stats.setMode(0)
    document.getElementById('stats').appendChild(stats.domElement)
    return stats
}

function initPointerLockControls() {
    // 鼠標鎖定初始化
    // controls = new PointerLockControls(camera)
    controls = new PointerLockControls( camera, document.body );
    controls.getObject().position.set(10, 0, 60)
    scene.add(controls.getObject())
  
    // 因為鼠標鎖定控制器需要通過用戶觸發，所以需要進入畫面
    const blocker = document.getElementById('blocker')
    const instructions = document.getElementById('instructions')
    const havePointerLock =
      'pointerLockElement' in document ||
      'mozPointerLockElement' in document ||
      'webkitPointerLockElement' in document
    if (havePointerLock) {
      instructions.addEventListener(
        'click',
        function() {
          controls.lock()
        },
        false
      )
      controls.addEventListener('lock', function() {
        instructions.style.display = 'none'
        blocker.style.display = 'none'
      })
      controls.addEventListener('unlock', function() {
        blocker.style.display = 'block'
        instructions.style.display = ''
      })
    } 
    else {
      instructions.innerHTML =
        '你的瀏覽器似乎不支援 Pointer Lock API，建議使用電腦版 Google Chrome 取得最佳體驗！'
    }
  
    const onKeyDown = function(event) {
      switch (event.keyCode) {
        case 38: // up
        case 87: // w
          moveForward = true
          break
        case 37: // left
        case 65: // a
          moveLeft = true
          break
        case 40: // down
        case 83: // s
          moveBackward = true
          break
        case 39: // right
        case 68: // d
          moveRight = true
          break
        case 32: // space
          if (canJump === true) velocity.y += 350 // 跳躍高度
          canJump = false
          break
      }
    }
    const onKeyUp = function(event) {
      switch (event.keyCode) {
        case 38: // up
        case 87: // w
          moveForward = false
          break
        case 37: // left
        case 65: // a
          moveLeft = false
          break
        case 40: // down
        case 83: // s
          moveBackward = false
          break
        case 39: // right
        case 68: // d
          moveRight = false
          break
      }
    }
    document.addEventListener('keydown', onKeyDown, false)
    document.addEventListener('keyup', onKeyUp, false)
  
    // 使用 Raycaster 實現簡單碰撞偵測
    raycaster = new THREE.Raycaster(
      new THREE.Vector3(),
      new THREE.Vector3(0, -1, 0),
      0,
      10
    )
}

let prevTime = Date.now()
let velocity = new THREE.Vector3() // 移動速度向量
let direction = new THREE.Vector3() // 移動方向向量

function pointerLockControlsRender() {
    if (controls.isLocked === true) {
      // 使用 Raycaster 判斷腳下是否與場景中物體相交
      raycaster.ray.origin.copy(controls.getObject().position) // 複製控制器的位置
      const intersections = raycaster.intersectObjects(scene.children, true) // 判斷是否在任何物體上
      const onObject = intersections.length > 0
  
      // 計算時間差
      const time = Date.now()
      const delta = (time - prevTime) / 1000 // 大約為 0.016
  
      // 設定初始速度變化
      velocity.x -= velocity.x * 10.0 * delta
      velocity.z -= velocity.z * 10.0 * delta
      velocity.y -= 9.8 * 100.0 * delta // 預設墜落速度
  
      // 判斷按鍵朝什麼方向移動，並設定對應方向速度變化
      direction.z = Number(moveForward) - Number(moveBackward)
      direction.x = Number(moveLeft) - Number(moveRight)
      // direction.normalize() // 向量正規化（長度為 1），確保每個方向保持一定移動量
      //---------------------------------------------------------------------------------變更移動速度的地方
      if (moveForward || moveBackward) velocity.z -= direction.z * 1600.0 * delta
      if (moveLeft || moveRight) velocity.x -= direction.x * 1600.0 * delta
  
      // 處理跳躍對應 y 軸方向速度變化
      if (onObject === true) {
        velocity.y = Math.max(0, velocity.y)
        canJump = true
      }
  
      // // 根據速度值移動控制器位置
      // controls.getObject().translateX(velocity.x * delta)
      // controls.getObject().translateY(velocity.y * delta)
      // controls.getObject().translateZ(velocity.z * delta)
      controls.moveRight( velocity.x * delta );
      controls.moveForward( - velocity.z * delta );

      controls.getObject().position.y += ( velocity.y * delta ); // new behavior
  
      // 控制器下墜超過 -2000 則重置位置
      if (controls.getObject().position.y < -2000) {
        velocity.y = 0
        controls.getObject().position.set(10, 100, 60) //10, 100, 60
        canJump = true
      }
  
      prevTime = time
    }
}

function Element( id, x, y, z, ry ) {

    const div = document.createElement( 'div' );
    div.style.width = '620px';
    div.style.height = '378px';
    div.style.backgroundColor = '#000';

    const iframe = document.createElement( 'iframe' );
    iframe.style.width = '620px';
    iframe.style.height = '378px';
    iframe.style.border = '0px';
    iframe.src = [ 'https://player.twitch.tv/?channel=', id ].join( '' );
    div.appendChild( iframe );
    const object = new CSS3DObject( div );
    object.position.set( x, y, z );
    object.rotation.y = ry;

    return object;

}

function discordInvite(x, y, z, ry ) {

  const div = document.createElement( 'div' );
  div.style.width = '350px';
  div.style.height = '500px';
  div.style.backgroundColor = '#000';

  const iframe = document.createElement( 'iframe' );
  iframe.style.width = '350px';
  iframe.style.height = '500px';
  iframe.style.border = '0px';
  iframe.src = [ 'https://discord.com/widget?id=1092208681157939332&theme=dark' ].join( '' );
  div.appendChild( iframe );

  const object = new CSS3DObject( div );
  object.position.set( x, y, z );
  object.rotation.y = ry;

  return object;

}

function myWebsite(x, y, z, ry ) {

  const div = document.createElement( 'div' );
  div.style.width = '1920px';
  div.style.height = '1080px';
  div.style.backgroundColor = '#000';

  const iframe = document.createElement( 'iframe' );
  iframe.style.width = '1920px';
  iframe.style.height = '1080px';
  iframe.style.border = '0px';
  iframe.src = [ '' ].join( '' );
  div.appendChild( iframe );

  const object = new CSS3DObject( div );
  object.position.set( x, y, z );
  object.rotation.y = ry;

  return object;

}

function twitch(x, y, z, ry ) {

  const div = document.createElement( 'div' );
  div.style.width = '480px';
  div.style.height = '360px';
  div.style.backgroundColor = '#000';

  const iframe = document.createElement( 'iframe' );
  iframe.style.width = '480px';
  iframe.style.height = '360px';
  iframe.style.border = '0px';
  iframe.src = [ 'https://player.twitch.tv/?channel=tenshi&parent=evanmelon.dev' ].join( '' );
  div.appendChild( iframe );

  const object = new CSS3DObject( div );
  object.position.set( x, y, z );
  object.rotation.y = ry;

  return object;

}

function spotify(x, y, z, ry ) {

    const div = document.createElement( 'div' );
    div.style.width = '480px';
    div.style.height = '360px';
    div.style.backgroundColor = '#000';

    const iframe = document.createElement( 'iframe' );
    iframe.style.width = '480px';
    iframe.style.height = '360px';
    iframe.style.border = '0px';
    iframe.src = [ 'https://open.spotify.com/embed/playlist/1JrCsBfaEELzsy5MoOQTU0?utm_source=generator' ].join( '' );
    div.appendChild( iframe );

    const object = new CSS3DObject( div );
    object.position.set( x, y, z );
    object.rotation.y = ry;

    return object;

}


function createGlRenderer() {
    glRenderer = new THREE.WebGLRenderer({alpha:true});

    glRenderer.setClearColor(0xaf2e2e);
    glRenderer.setPixelRatio(window.devicePixelRatio);
    glRenderer.setSize(window.innerWidth, window.innerHeight);

    glRenderer.domElement.style.position = 'absolute';
    glRenderer.domElement.style.zIndex = 1;
    glRenderer.domElement.style.top = 0;

    return glRenderer;
}

function createCssRenderer() {
    cssRenderer = new CSS3DRenderer();

    cssRenderer.setSize(window.innerWidth, window.innerHeight);

    cssRenderer.domElement.style.position = 'absolute';
    glRenderer.domElement.style.zIndex = 0; //這裡怪怪的，可能是css
    cssRenderer.domElement.style.top = 0;

    return cssRenderer;
}

let iframe, cssObject;
function createCssObject(w, h, position, rotation, url) {
    // var html = [
    //     '<div style="width:' + w + 'px; height:' + h + 'px;">',
    //     '<iframe src="' + url + '" width="' + w + '" height="' + h + '">',
    //     '</iframe>',
    //     '</div>'
    // ].join('\n');

    iframe = document.createElement('iframe')
    iframe.src = './hi.html';
    iframe.style.width = w + 'px';
    iframe.style.height = h + 'px';
    iframe.style.border = '0px';

    cssObject = new CSS3DObject(iframe);

    cssObject.position.x = position.x;
    cssObject.position.y = position.y;
    cssObject.position.z = position.z;

    cssObject.rotation.x = rotation.x;
    cssObject.rotation.y = rotation.y;
    cssObject.rotation.z = rotation.z;
    console.log(cssObject);
    return cssObject;
}

function createPlane(w, h, position, rotation) {
    var material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.0,
        side: THREE.DoubleSide
    });

    var geometry = new THREE.PlaneGeometry(w, h);

    var mesh = new THREE.Mesh(geometry, material);

    mesh.position.x = position.x;
    mesh.position.y = position.y;
    mesh.position.z = position.z;

    mesh.rotation.x = rotation.x;
    mesh.rotation.y = rotation.y;
    mesh.rotation.z = rotation.z;
    return mesh;
}

function create3dPage(w, h, position, rotation, url) {
    var plane = createPlane(
        w, h,
        position,
        rotation
    );
    // glScene.add(plane);
    // scene.add(plane);
    // var cssObject = createCssObject(
    //     w, h,
    //     position,
    //     rotation,
    //     url
    // );
    let domEle = document.createElement("div");
    domEle.innerHTML = "<div><iframe src='./hi.html'></iframe></div>";
    let domEleObj = new CSS3DObject(domEle);
    domEleObj.position.set(0, 0, 0);
    scene.add(domEleObj);
    console.log(domEleObj)
    // cssScene.add(cssObject);
    // scene.add(cssObject);
}

function createColoredMaterial() {
    var material = new THREE.MeshBasicMaterial({
        color: Math.floor(Math.random() * 16777215),
        // shading: THREE.FlatShading,
        side: THREE.DoubleSide
    });

    return material;
}

function create3dGeometry() {
    var mesh1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0, 200, 300, 20, 4),
        createColoredMaterial()
    );

    mesh1.position.x = 0;
    mesh1.position.y = 0;
    mesh1.position.z = 0;
    // glScene.add(mesh1);
    scene.add(mesh1);
}

function render() {
    // controls.update();
    // stats.update()
    // cameraControl.update()
    pointerLockControlsRender()
    // glRenderer.render(glScene, camera);
    // cssRenderer.render(cssScene, camera);
    labelRenderer.render(scene, camera)
    renderer.render(scene, camera)
    requestAnimationFrame(render)
}

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})

function init() {
    scene = new THREE.Scene();
    container = document.getElementById('container');
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set(100, 100, 100)
    camera.lookAt(scene.position)

    // stats = initStats()

    // 渲染器設定
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild(renderer.domElement);

    glRenderer = createGlRenderer();
    cssRenderer = createCssRenderer();

    labelRenderer = new CSS3DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    // labelRenderer.domElement.style.position.set(0, -50, 50);
    labelRenderer.domElement.style.top = 0;
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    // document.body.appendChild(glRenderer.domElement);
    // cssRenderer.domElement.appendChild(glRenderer.domElement);

    // glScene = new THREE.Scene();
    // cssScene = new THREE.Scene();

    var ambientLight = new THREE.AmbientLight(0x555555);
    // glScene.add(ambientLight);
    // scene.add( ambientLight );

    var directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(-.5, .5, -1,5).normalize();
    // glScene.add(directionalLight);
    scene.add( directionalLight );

    const geometry = new THREE.BoxGeometry( 10, 10, 10 );
    const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    const cube = new THREE.Mesh( geometry, material );
    // scene.add( cube );

    let axes = new THREE.AxesHelper(20) // 參數為座標軸長度
    // scene.add(axes)

    // stats = initStats()

    // renderer = new THREE.WebGLRenderer({ antialias: true })
    // renderer.setClearColor(0x80adfc, 1.0)
    // renderer.setClearColor(0x111111, 1.0)
    // renderer.setSize(window.innerWidth, window.innerHeight)
    // renderer.shadowMap.enabled = true
    // renderer.shadowMap.type = 2 // THREE.PCFSoftShadowMap

    // 簡單的地板
    const planeGeometry = new THREE.PlaneGeometry(10000, 10000)
    const planeMaterial = new THREE.MeshLambertMaterial({ color: 0x0f5bb3 })
    let plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.rotation.x = -0.5 * Math.PI
    plane.position.set(0, -7, 0)
    scene.add(plane)
    // create3dPage(50, 50, new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 45 * Math.PI / 180, 0), './hi.html');
    // create3dGeometry();

    const group = new THREE.Group();
    group.add( new Element( 'pipluptiny&parent=evanmelon.dev', 0, 0, 310, 0 ) );
    group.add( new Element( 'tenshi&parent=evanmelon.dev', 310, 0, 0, Math.PI / 2 ) );
    group.add( new Element( 'mande&parent=evanmelon.dev', 0, 0, - 310, Math.PI ) );
    // group.add( new Element( 'cocoii7878&parent=localhost', - 310, 0, 0, - Math.PI / 2 ) );
    // group.add( new Element( 'pipluptiny&parent=localhost', 0, 0, 310, Math.PI ) );
    // group.add( new Element( 'tenshi&parent=localhost', 310, 0, 0, -Math.PI / 2 ) );
    // group.add( new Element( 'mande&parent=localhost', 0, 0, - 310, 0 ) );
    // // group.add( new Element( 'cocoii7878&parent=localhost', - 310, 0, 0, Math.PI / 2 ) );
    scene.add( group );
    scene.add(spotify(500, 0, 500, 0))
    // scene.add(twitch(0, 500, 0, 0))
    // scene.add(myWebsite(1000, 0, 0, Math.PI / 2))
    scene.add(discordInvite(0, 0, 500, 0))

    initSky(scene);
    
    initPointerLockControls();

    let spotLight = new THREE.SpotLight(0xffffff)
    spotLight.position.set(-10, 40, 30)
    // scene.add(spotLight)

    document.body.appendChild( renderer.domElement );
    // glRenderer.domElement.appendChild(renderer.domElement);
    // cssRenderer.domElement.appendChild(glRenderer.domElement);
//////////////////////////////////////////////////////////////////////////////////////////
    let floorGeometry = new THREE.PlaneGeometry( 2000, 2000, 100, 100 );
    floorGeometry.rotateX( - Math.PI / 2 );

    // vertex displacement

    let position = floorGeometry.attributes.position;

    for ( let i = 0, l = position.count; i < l; i ++ ) {

      vertex.fromBufferAttribute( position, i );

      vertex.x += Math.random() * 20 - 10;
      vertex.y += Math.random() * 2;
      vertex.z += Math.random() * 20 - 10;

      position.setXYZ( i, vertex.x, vertex.y, vertex.z );

    }

    floorGeometry = floorGeometry.toNonIndexed(); // ensure each face has unique vertices

    position = floorGeometry.attributes.position;
    const colorsFloor = [];

    for ( let i = 0, l = position.count; i < l; i ++ ) {

      color.setHSL( Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace );
      colorsFloor.push( color.r, color.g, color.b );

    }

    floorGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colorsFloor, 3 ) );

    const floorMaterial = new THREE.MeshBasicMaterial( { vertexColors: true } );

    const floor = new THREE.Mesh( floorGeometry, floorMaterial );
    // scene.add( floor );

    // objects

    const boxGeometry = new THREE.BoxGeometry( 20, 20, 20 ).toNonIndexed();

    position = boxGeometry.attributes.position;
    const colorsBox = [];

    for ( let i = 0, l = position.count; i < l; i ++ ) {

      color.setHSL( Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace );
      colorsBox.push( color.r, color.g, color.b );

    }

    boxGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colorsBox, 3 ) );

    for ( let i = 0; i < 500; i ++ ) {

      const boxMaterial = new THREE.MeshPhongMaterial( { specular: 0xffffff, flatShading: true, vertexColors: true } );
      boxMaterial.color.setHSL( Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace );

      const box = new THREE.Mesh( boxGeometry, boxMaterial );
      box.position.x = Math.floor( Math.random() * 20 - 10 ) * 20;
      box.position.y = Math.floor( Math.random() * 20 ) * 20 + 10;
      box.position.z = Math.floor( Math.random() * 20 - 10 ) * 20;

      // scene.add( box );
      // objects.push( box );

    }

}



init();
render();