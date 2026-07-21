import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UiLayerQuote } from './ui-layer-quote';
import { Camera, Vector3 } from 'three';

export class UiLayer {
    
    protected _svgDom:SVGElement;
    protected _threeCameraController:OrbitControls;

    protected _uiItems:UiLayerQuote[] = [];

    constructor(threeCameraController:OrbitControls){
        this._threeCameraController = threeCameraController;
        this._threeCameraController.addEventListener("change", this.onCameraOrbitChange);
        this.build();
        this.setSize(this._threeCameraController.domElement!.clientWidth,this._threeCameraController.domElement!.clientHeight);
    }

    build = () =>{
        this._svgDom = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        let _defArrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
        _defArrow.id = "arrow";
        _defArrow.setAttribute("d", "M 1 0 L -15 -5 L -15 5 Z");
        _defArrow.setAttribute("fill", "currentColor");
        defs.appendChild(_defArrow);
        this._svgDom.id = "ui-layer";
        this._svgDom.appendChild(defs);
        document.body.appendChild(this._svgDom);
    }

    private screenScalarOffset:Vector3 = new Vector3(1,-1,0);

    getScreenCoord = (point3d:Vector3):Vector3 =>{
        // console.log(point3d);
        return point3d.clone().project(this._threeCameraController.object as Camera).add(this.screenScalarOffset).multiply(this.screenFactorToPx);
    }

    onCameraOrbitChange = () =>{
        this.update();
    }


    addQuote(node:any){

        let _quote:UiLayerQuote = new UiLayerQuote(node, this);
           this._svgDom.appendChild(_quote.getNode());

        this._uiItems.push(_quote);
        _quote.update();


        /*
        {
            "id": "DIM_HAUTEUR2_ST_BAN",
            "description": "Avancée du store",
            "color": "#3F61AA",
            "start": {
                "x": -200,
                "y": 0,
                "z": 3600
            },
            "end": {
                "x": -200,
                "y": 1800,
                "z": 3600
            },
            "text": "Avancée 3000 mm"
        }
            */

    }

    destroy(){
        document.body.removeChild(this._svgDom);
        this._threeCameraController.removeEventListener("change", this.onCameraOrbitChange);
        this._uiItems.splice(0);
    }

    update(){
        // console.log("update");
        
        this._uiItems.map((item:UiLayerQuote)=>{
            item.update();
        })
    }

    private screenFactorToPx:Vector3 = new Vector3(0,0,1);
    setSize(width:number, height:number){
        this.screenFactorToPx.x = width*.5;
        this.screenFactorToPx.y = height*-.5;
    }
}