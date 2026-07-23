import './scss/style.scss'
import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { TextureAtlas } from './texture.atlas';
import { WorldBox3D } from './decors-wall.three.object3d';
import { UiLayer } from './ui-layer';

const MM_TO_METER:number = 0.001;

class App {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private gui: any;

  private uiLayer: UiLayer;

  // private morphMeshes: THREE.Mesh[] = [];

  private loadedGeometries: THREE.BufferGeometry[] = [];
  private helpers: THREE.Object3D[] = [];
  private materials: THREE.MeshStandardMaterial[] = [];
  private loadedJSON: any;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color( 0xFFFFFF );
    // this.scene.fog = new THREE.Fog( 0xFFFFFF, 5,10 );

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0,3,5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.controls = new OrbitControls( this.camera, this.renderer.domElement );
    this.controls.enableDamping = true;
    this.controls.minDistance = .01;
    this.controls.maxDistance = 1000;
    this.controls.target.set( 3, 0, 1 );


    this.controls.update();


    this.initLight();
    this.initGlobalHelper();
    this.loadDefaultAssets();
    this.addEventListeners();
    this.animate();
  }


  private destroy() {

    

    while (this.materials.length) {
      let _mat:THREE.MeshStandardMaterial = this.materials.pop()!;
      _mat.dispose();
    }

    this.helpers.splice(0, this.helpers.length);

    this.uiLayer.destroy();

    if(this.gui) {
      this.gui.destroy();
      this.gui = null;
    };

    this.scene.traverse((object:any) => {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        materials.forEach((mat:any) => {
          // Dispose des textures du matériau
          Object.values(mat).forEach((value:any) => {
            if (value?.isTexture) value.dispose();
          });
          mat.dispose();
        });
      }
    });

    this.scene.clear(); // supprime tous les enfants
  }

  private initLight() {

    const SHADOW_MAP_WIDTH = 4096, SHADOW_MAP_HEIGHT = 4096;

    // Lumières
    const ambientLight = new THREE.AmbientLight(0xffffff, .5);
    this.scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 200);
    spotLight.position.set(5, 15, 5);
    spotLight.angle = Math.PI / 5;  // 36° — couvre toute la scène depuis y=15
    spotLight.penumbra = 0.3;       // bords doux
    spotLight.decay = 2;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = SHADOW_MAP_WIDTH;
		spotLight.shadow.mapSize.height = SHADOW_MAP_HEIGHT;
    spotLight.shadow.camera.near = 1;
    spotLight.shadow.camera.far = 40;
    this.scene.add(spotLight);
    // La target doit être dans la scène pour fonctionner
    spotLight.target.position.set(2, 0, 0);
    this.scene.add(spotLight.target);
  }

  private initGlobalHelper(){
    // grid
    const axesHelper = new THREE.AxesHelper( 5 );
    axesHelper.position.y = .001;
    axesHelper.visible = false;
    // axesHelper.scale.z = -1;
    this.scene.add( axesHelper );


    const gridHelper = new THREE.GridHelper( 10,100, 0xeeeeee, 0xeeeeee );
    gridHelper.visible = false;
    this.scene.add( gridHelper );

    this.helpers.push(axesHelper, gridHelper);

  }

  private async loadDefaultAssets(): Promise<void> {
    await this.loadAndParse3dAsset();
    await this.loadJson();
    this.buildUiLayer();
    await this.buildFromLoadedAssets();
  }

  private async buildFromLoadedAssets() {
    // console.log(this.loadedJSON);
    await TextureAtlas.init(this.loadedJSON.materials);
    this.buildJsonNode(this.loadedJSON);
    this.initGUI(false);
    
  }

  private focusOrbitOnObject = (object:any, distance = 1) => {
    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Target = centre de la bounding box
    this.controls.target.copy(center);

    // Place la caméra à `distance` mètres du centre, dans sa direction actuelle
    const direction = this.camera.position.clone()
      .sub(center)
      .normalize();

    this.camera.position.copy(center).addScaledVector(direction, distance);

    this.controls.update();
  }

  private initGUI(withHelpers:boolean) {
    this.gui = new GUI();
    this.gui.add(this.helpers[0], "visible").name("Axes");
    this.gui.add(this.helpers[1], "visible").name("Grille");
    this.gui.add(this.helpers[2], "visible").name("Cone de cotations");

    
    this.gui.add(document.getElementById("jsonFileInput"), "click").name("Import JSON");
    this.gui.add(document.getElementById("glbFileInput"), "click").name("Import GLB");
    
    let _folders:any = {};
    _folders[this.scene.uuid] = this.gui.addFolder("ROOT");
    this.scene.traverse((object:any)=>{
      if(object.type == "Group" || object.type == "Mesh" || object instanceof WorldBox3D){
        _folders[object.uuid] = _folders[object.parent.uuid].addFolder(object.name);
        // _folders[object.uuid].close();
        _folders[object.uuid].add(object, "visible");
        if(object.type == "Group"){
          if(object.userData.dimension){
            _folders[object.uuid].add(object.children[0], "visible").name("areaDimension");
          }
        }
        let _positionFolder = _folders[object.uuid].addFolder("Position");
        _positionFolder.close();
        _positionFolder.add(object.position, "x",-1,5,0.001);
        _positionFolder.add(object.position, "y",-1,5,0.001);
        _positionFolder.add(object.position, "z",-1,5,0.001);
        let _rotationFolder = _folders[object.uuid].addFolder("Rotation");
        _rotationFolder.close();
        _rotationFolder.add(object.rotation, "x",-3.15,3.15,0.001);
        _rotationFolder.add(object.rotation, "y",-3.15,3.15,0.001);
        _rotationFolder.add(object.rotation, "z",-3.15,3.15,0.001);

        if(withHelpers){

          const helper = new THREE.AxesHelper(0.1);
          this.scene.add(helper); // helper est au root
          helper.renderOrder = 999;
          (helper.material as any).depthTest = false;
          const worldPos = new THREE.Vector3();
          const worldQuat = new THREE.Quaternion();
  
          object.getWorldPosition(worldPos);
          object.getWorldQuaternion(worldQuat);
          helper.visible = false;
  
          helper.position.copy(worldPos);
          helper.quaternion.copy(worldQuat);
  
          _positionFolder.add(helper, "visible").name("Voir pivot");
        }

        let focus:any = {
          focus : () => {
            this.focusOrbitOnObject(object);
          }
        }
        _folders[object.uuid].add(focus, "focus").name("Focus");

      } else {
        // console.log(object);
      }
      if(object.name == "MAT_TOILE_STD"){
        this.focusOrbitOnObject(object);
      }
      // console.log(object);
      
    });
  }


  private buildUiLayer() {
    this.uiLayer = new UiLayer(this.controls);
    console.log(this.loadedJSON);

    let coneVisibilityGroup = new THREE.Group();
    coneVisibilityGroup.visible = false;
    this.scene.add(coneVisibilityGroup);
    this.helpers.push(coneVisibilityGroup);
    
    
    for (let i = 0; i < this.loadedJSON.cotations.length; i++) {
      this.uiLayer.addQuote(this.loadedJSON.cotations[i]);

      let coneHelper = this.generateCotationCone(this.loadedJSON.cotations[i]);
      coneVisibilityGroup.add(coneHelper);
      
    }
  }

  private generateCotationCone(node:any):THREE.Mesh{
    const material = new THREE.MeshBasicMaterial( {
      color: 0xe0e0ff,
			wireframe: true
    } );
    let _angle = THREE.MathUtils.degToRad(node.visibilityCone ? node.visibilityCone.angle : 90);
    let _cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(_angle*.5)*2,2,8,1,true), material);
    
    _cone.geometry.rotateX(Math.PI*-.5);
    _cone.geometry.translate(0, 0,1);

    let _3dStart = new THREE.Vector3(
        node.start.x*MM_TO_METER,
        node.start.y*MM_TO_METER,
        node.start.z*MM_TO_METER
    );
    let _3dEnd = new THREE.Vector3(
        node.end.x*MM_TO_METER,
        node.end.y*MM_TO_METER,
        node.end.z*MM_TO_METER
    );

    let _3dMiddle = new THREE.Vector3().lerpVectors(_3dStart, _3dEnd, 0.5);


    _cone.position.copy(_3dMiddle);

    let _localLookAt = new THREE.Vector3(0,0,1);
    if(node.visibilityCone){


      _localLookAt.set(
          node.visibilityCone.axis.x,
          node.visibilityCone.axis.y,
          node.visibilityCone.axis.z
      )
    }
    _localLookAt.add(_3dMiddle);
    //console.log(node.visibilityCone, _3dMiddle, _localLookAt);
      
    _cone.lookAt(_localLookAt);

    return _cone;
  }


  private initPlane(node:any): THREE.Mesh {


    let _geometry:THREE.PlaneGeometry = new THREE.PlaneGeometry(1,1,10,10);
    _geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    // Déplace le pivot au coin back-left
    // Back = -Z (en Three.js, Z négatif = "devant", donc +Z = "derrière")
    // Left = -X
    // Le centre est à (0,0,0), donc on décale de (+width/2, 0, -depth/2)
    _geometry.translate(.5, 0, .5);
    _geometry.computeBoundingBox();


    let _mesh = new THREE.Mesh(_geometry, TextureAtlas.getMaterialByName(node.material));

    return _mesh;
  }

  private initWorldBox(jsonNode:any): WorldBox3D {
    let _mesh:WorldBox3D = new WorldBox3D(
      jsonNode.dimension.width * MM_TO_METER,
      jsonNode.dimension.height * MM_TO_METER,
      jsonNode.dimension.depth * MM_TO_METER,
      TextureAtlas.getMaterialByName(jsonNode.material)
    );
    return _mesh;
  }

  private initBox(node:any): THREE.Mesh {

    let _geometry:THREE.BoxGeometry = new THREE.BoxGeometry(1,1,1,10,10,10);
    _geometry.translate(.5, .5,.5);
    _geometry.computeBoundingBox();

    let _mesh = new THREE.Mesh(_geometry, TextureAtlas.getMaterialByName(node.material));

    return _mesh;
  }

  private initMesh(node:any): THREE.Mesh|null {
    let _geometry:THREE.BufferGeometry|undefined = this.loadedGeometries.find((geo:THREE.BufferGeometry)=>{
      return geo.name == node.meshId;
    });

    if(!_geometry) {
      console.error(`Mesh [${node.meshId}] not found`);
      return null;
    }
    let _mesh = new THREE.Mesh(_geometry, TextureAtlas.getMaterialByName(node.material));

    return _mesh;
  }

  
  private buildJsonNode(jsonNode:any, parent:any = null): void {
    if(!parent){
      parent = this.scene;
    }

    let type:string = jsonNode.type;
    if(!type && (jsonNode.elements?.length > 0)) type = "Group";
    if(type == "Mesh" && (jsonNode.elements?.length > 0)) type = "Group";

    let _object:THREE.Group|THREE.Mesh|WorldBox3D|null|undefined;

    switch (type) {

      case "WorldBox":
        _object = this.initWorldBox(jsonNode);
        this.handlePosition(_object, jsonNode);
        (_object as WorldBox3D).update();
        break;

      case "Box":
        _object = this.initBox(jsonNode);
        this.handlePosition(_object, jsonNode);
        break;

      case "Plane":
        _object = this.initPlane(jsonNode);
        this.handlePosition(_object, jsonNode);
        break;

      case "Mesh":
        _object = this.initMesh(jsonNode);
        this.handlePosition(_object, jsonNode);
        break;

      case "Group":
        _object = new THREE.Group();
        this.handlePosition(_object, jsonNode);
        // console.log(jsonNode);
        if(jsonNode.dimension){
          let _geoHelper = new THREE.BoxGeometry(
            jsonNode.dimension.width * MM_TO_METER,
            jsonNode.dimension.height * MM_TO_METER,
            jsonNode.dimension.depth * MM_TO_METER,
          );
          _geoHelper.translate(
            jsonNode.dimension.width * MM_TO_METER *.5,
            jsonNode.dimension.height * MM_TO_METER *.5,
            jsonNode.dimension.depth * MM_TO_METER *.5
          );
          let _helper = new THREE.BoxHelper(new THREE.Mesh(_geoHelper));
          _helper.visible = false;
          _object.add(_helper);
        }
        if(jsonNode.type == "Mesh"){
          let _firstMesh:THREE.Object3D|null = this.initMesh(jsonNode);
          if(_firstMesh){
            _firstMesh.name = jsonNode.id;
            _object.add(_firstMesh);
          }
        }
        for (let i = 0; i < jsonNode.elements?.length; i++) {
          jsonNode.elements[i].parent = jsonNode;
          this.buildJsonNode(jsonNode.elements[i], _object);
        }
        break;
    
      default:
        break;
    }

    if(_object){
      _object.castShadow = jsonNode.castShadow !== false;
      _object.receiveShadow = jsonNode.receiveShadow !== false;

      _object.name = jsonNode.id;
      // console.log(_object.name, _object);
      
      parent.add(_object);
      
      

      
    }
    
  }

  private handlePosition(object:THREE.Mesh|THREE.Group|WorldBox3D|null, jsonNode:any){
    // console.log(jsonNode);
    if(!object) return;

    object.userData = jsonNode;
    let parentJsonNode:any = jsonNode.parent;
    
    if(jsonNode.position){
      object.position.x = jsonNode.position.x * MM_TO_METER;
      object.position.y = jsonNode.position.y * MM_TO_METER;
      object.position.z = jsonNode.position.z * MM_TO_METER;
    }

    if(jsonNode.rotation){
      object.rotation.x = jsonNode.rotation.x * THREE.MathUtils.DEG2RAD;
      object.rotation.y = jsonNode.rotation.y * THREE.MathUtils.DEG2RAD;
      object.rotation.z = jsonNode.rotation.z * THREE.MathUtils.DEG2RAD;
    } else {

    }

    if(jsonNode.dimension && object instanceof THREE.Mesh){
      let size = (object as THREE.Mesh).geometry.boundingBox?.getSize(new THREE.Vector3());
      
      if(jsonNode.dimension.length) {
        // console.log(jsonNode.dimension,size, (object as THREE.Mesh).geometry.boundingBox);
        object.scale.x = (jsonNode.dimension.length * MM_TO_METER)/size!.x;
      }
      
      if(jsonNode.dimension.width) {
        object.scale.x = (jsonNode.dimension.width * MM_TO_METER)/size!.x;
      }

      if(jsonNode.dimension.height) {
        object.scale.y = (jsonNode.dimension.height * MM_TO_METER)/size!.y;
      }

      if(jsonNode.dimension.depth) {
        object.scale.z = (jsonNode.dimension.depth * MM_TO_METER)/size!.z;
      }

      if(object.material instanceof THREE.MeshStandardMaterial && !(object instanceof WorldBox3D)){
        if(object.material.userData.texturesWidth){
          let repeatX:number = (object.scale.x*size!.x)/object.material.userData.texturesWidth;
          let repeatY:number = size!.y < 0.001 ? (object.scale.z*size!.z)/object.material.userData.texturesWidth : (object.scale.y*size!.y)/object.material.userData.texturesWidth;
          // console.log(repeatX,repeatY, object.scale.x, size!.x, object.scale.y, size!.y);

          object.material.map?.repeat.set(repeatX,repeatY);
          object.material.normalMap?.repeat.set(repeatX,repeatY);
          object.material.roughnessMap?.repeat.set(repeatX,repeatY);
          
        }
      }


      
    }

    if(jsonNode.reference && parentJsonNode?.dimension){
      // console.log(jsonNode);
      
      object.position.x += (jsonNode.reference[0]+1)*0.5*parentJsonNode.dimension.width * MM_TO_METER;
      object.position.y += (jsonNode.reference[1]+1)*0.5*parentJsonNode.dimension.height * MM_TO_METER;
      object.position.z += (jsonNode.reference[2]+1)*0.5*parentJsonNode.dimension.depth * MM_TO_METER;
    }

  }

  
  private loadJson(): Promise<void> {
    return new Promise((resolve, reject)=>{

      // let _jsonUrl:string = "JSON_Banne_3D_2026-06-04.json";
      // let _jsonUrl:string = "JSON_Banne_3D_2026-06-04-PASSERELLE.json";
      // let _jsonUrl:string = "JSON_Banne_3D_2026-06-12-PASSERELLE.json";
      // let _jsonUrl:string = "JSON_Banne_3D_2026-06-18-PASSERELLE.json";
      let _jsonUrl:string = "JSON_Banne_3D_2026-07-20-PASSERELLE.json";

      fetch(_jsonUrl).then((response:any)=>{
        response.json().then((jsonResponse:any)=>{
          this.loadedJSON = jsonResponse;
          resolve();
        },(errorParse:any)=>{
          reject(errorParse);
        })
      },(error)=>{
        reject(error);
      })
    });
  }

  private loadAndParse3dAsset(url?:string): Promise<void> {

    while (this.loadedGeometries.length) {
      let _geo:THREE.BufferGeometry = this.loadedGeometries.pop()!;
      _geo.dispose();
    }
    
    return new Promise((resolve, reject)=>{
      const loader = new GLTFLoader();
      // let gltfDefaultPath:string = "ST_BAN_BRAS_3.glb";
      // let gltfDefaultPath:string = "Test_Shapekeys_Multimat.glb";
      // let gltfDefaultPath:string = "test_json_ZUp.glb";
      // let gltfDefaultPath:string = "test_json.glb";
      // let gltfDefaultPath:string = "text JSON_YUp.glb";
      // let gltfDefaultPath:string = "ST_BAN_TOUS_MODELES1.glb";
      let gltfDefaultPath:string = "ST_BAN_TOUS_MODELES2.glb";
      // let gltfDefaultPath:string = "Test_Shapekeys_Multimat_NoShapekeys.glb";
      // let gltfDefaultPath:string = "Test_Shapekeys_Multimat_Texture.glb";

      loader.load(url ?? gltfDefaultPath, (gltf:any) => {
        
        
        gltf.scene.traverse((node:any) => {
          if (node.isMesh) {
            // console.log(node.name);
            let geometry:THREE.BufferGeometry = node.geometry;
            geometry.name = node.name;

            // Applique la transformation du mesh à la géométrie
            // node.updateMatrix();
            // geometry.applyMatrix4(node.matrix);

            geometry.computeBoundingBox();
            
            this.loadedGeometries.push(geometry);
          }
        });

        resolve();
      
      },
      undefined,
      (error) => {
        console.error("Error loading GLB:", error);
        reject(error);
      });
    });
  }

  private addEventListeners(): void {
    window.addEventListener('resize', this.onResize);

    document.getElementById("glbFileInput")!.addEventListener("change", async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);

        this.destroy();
        this.initLight();
        this.initGlobalHelper();
        await this.loadAndParse3dAsset(url);
        this.buildUiLayer();
        await this.buildFromLoadedAssets();
        URL.revokeObjectURL(url); // libère la mémoire

    });

    document.getElementById("jsonFileInput")!.addEventListener("change", async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        this.loadedJSON = JSON.parse(text);

        this.destroy();
        this.initLight();
        this.initGlobalHelper();
        this.buildUiLayer();
        await this.buildFromLoadedAssets();

    });
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.uiLayer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    // this.uiLayer.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Point d'entrée
const canvas = document.querySelector<HTMLCanvasElement>('#app');
if (!canvas) throw new Error('Canvas #app introuvable');

new App(canvas);