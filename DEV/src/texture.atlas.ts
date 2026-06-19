import * as THREE from 'three';
import { HDRCubeTextureLoader } from 'three/examples/jsm/loaders/HDRCubeTextureLoader.js';



export class TextureAtlas {

  protected static textureLib:any;

  protected static _ready:boolean;
  protected static _skyEnv:THREE.CubeTexture;
  protected static _materialList:any[] = [];
  protected static _textureList:any[] = [];

  static get ready():boolean {
    return this._ready;
  }
  
  static init(jsonMaterialList:any):Promise<void>{

    this._materialList.splice(0,this._materialList.length);

    this._ready = false;

    const _texture_path = '/textures/';

    // Sky env
    const _skyboxes_path = _texture_path+'skyboxes/';
    const hdrUrls = [ 'px.hdr', 'nx.hdr', 'py.hdr', 'ny.hdr', 'pz.hdr', 'nz.hdr' ];

    return new Promise((resolve, reject)=>{

      const manager = new THREE.LoadingManager();
      this.textureLib = {};

      manager.onStart = (url, itemsLoaded, itemsTotal) => {
        // console.log( 'Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
      };
      manager.onProgress = (url, itemsLoaded, itemsTotal) => {
        // console.log( 'Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
      };
      
      manager.onLoad = () => {
        this.initMaterial(jsonMaterialList);
        this._ready = true;
        resolve();
      };

      manager.onError = (url) => {
        reject('There was an error loading ' + url);
      };

      
      let _hdrCubeTextureLoader = new HDRCubeTextureLoader(manager);
      let _textureLoader = new THREE.TextureLoader(manager);

      _hdrCubeTextureLoader.setPath(_skyboxes_path+"symmetrical_garden_02_4k/");
      _hdrCubeTextureLoader.load(hdrUrls, (cubeTexture3)=>{
        this._skyEnv = cubeTexture3;
      });

      let _textureUrls:string[] = [];
      jsonMaterialList.map((node:any)=>{
        if(node.map) _textureUrls.push(node.map);
        if(node.normalMap) _textureUrls.push(node.normalMap);
        if(node.roughnessMap) _textureUrls.push(node.roughnessMap);
      });

      _textureUrls.map((url:any)=>{
        _textureLoader.load(_texture_path+url, (texture:THREE.Texture)=>{
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.colorSpace = THREE.SRGBColorSpace;
            this._textureList.push({
              url:url,
              texture:texture
            });
        });
      });
     
    });

  }
  
  static getTexture(url:string):THREE.Texture {
    let _r = this._textureList.find((row:any)=>{
      return row.url == url;
    })

    return _r.texture;
  }
  
  static initMaterial(jsonMaterialList:any):void{
		this._materialList.push({
      id: "Default",
      material: new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xff0000)
      })
    });
      
    jsonMaterialList.map((node:any)=>{

      let _mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(node.color ? node.color : 0xffffff)
      });
      if(node.roughness) _mat.roughness = node.roughness;
      if(node.metalness) _mat.metalness = node.metalness;
      if(node.metallic) _mat.metalness = node.metallic;
      if(node.opacity !== undefined) _mat.opacity = node.opacity;
      if(_mat.opacity < 1) _mat.transparent = true;
      if(node.bothSided) _mat.side = THREE.DoubleSide;
      if(node.map) _mat.map = this.getTexture(node.map);
      if(node.normalMap) _mat.normalMap = this.getTexture(node.normalMap);
      if(node.roughnessMap) _mat.roughnessMap = this.getTexture(node.roughnessMap);
      if(node.envMapIntensity){
        _mat.envMap = this._skyEnv;
        _mat.envMapIntensity = node.envMapIntensity;
      };
      if(node.texturesMmWidth){
        _mat.userData.texturesWidth = node.texturesMmWidth*0.001;
      }

      this._materialList.push({
        id: node.id,
        material: _mat
      });

    })
  }





  public static getMaterialByName = (id:string) => {
    let _r = this._materialList.find((row:any)=>{
      return row.id == id;
    })

    if(!_r){
      console.error(`Material [${id}] not found`);
      return this._materialList[0].material;
    }

    return _r.material;
  }


}
  