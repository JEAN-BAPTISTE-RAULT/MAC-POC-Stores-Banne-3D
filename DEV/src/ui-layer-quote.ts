import { Vector3, type Vector2 } from "three";
import type { UiLayer } from "./ui-layer";

export class UiLayerQuote {
    
    protected _svgDom:SVGGElement;
    protected _parent:UiLayer;
    protected _color:string;
    protected _text:string;

    protected _3dStart:Vector3;
    protected _3dEnd:Vector3;
    
    protected _2dStart:Vector3 = new Vector3();
    protected _2dEnd:Vector3 = new Vector3();
    
    protected _svgStart:SVGUseElement;
    protected _svgEnd:SVGUseElement;
    protected _svgLine:SVGLineElement;
    protected _svgText:SVGLineElement;

    constructor(node:any, parent:UiLayer){

        const MM_TO_METER:number = 0.001;

        this._3dStart = new Vector3(
            node.start.x*MM_TO_METER,
            node.start.y*MM_TO_METER,
            node.start.z*MM_TO_METER
        );
        this._3dEnd = new Vector3(
            node.end.x*MM_TO_METER,
            node.end.y*MM_TO_METER,
            node.end.z*MM_TO_METER
        );
            
        this._parent = parent;
        this._color = node.color;
        this.build();
    }
    
    build(){
        this._svgDom = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this._svgDom.style.color = this._color;
        this._svgStart = document.createElementNS("http://www.w3.org/2000/svg", "use");
        this._svgStart.setAttribute("href", "#arrow");
        // this._svgStart.setAttribute('fill', "currentColor");
        this._svgEnd = document.createElementNS("http://www.w3.org/2000/svg", "use");
        this._svgEnd.setAttribute("href", "#arrow");
        // this._svgEnd.setAttribute('fill', this._color);
        this._svgLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        this._svgLine.setAttribute('stroke', "currentColor");
        this._svgLine.setAttribute('stroke-width', "1.5");

        this._svgDom.appendChild(this._svgStart);
        this._svgDom.appendChild(this._svgEnd);
        this._svgDom.appendChild(this._svgLine);
    }

    update(){
        // console.log(this._parent.getScreenCoord(this._3dStart));

        this._2dStart.copy(this._parent.getScreenCoord(this._3dStart));
        this._2dEnd.copy(this._parent.getScreenCoord(this._3dEnd));

        const dx = this._2dEnd.x - this._2dStart.x;
        const dy = this._2dEnd.y - this._2dStart.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        const angleEnd = angle;         // pointe dans le sens de la ligne
        const angleStart = angle + 180; // pointe à l'opposé
        
        
        this._svgStart.setAttribute('transform', `translate(${this._2dStart.x} ${this._2dStart.y}) rotate(${angleStart})`);
        this._svgEnd.setAttribute('transform', `translate(${this._2dEnd.x} ${this._2dEnd.y}) rotate(${angleEnd})`);

        this._svgLine.setAttribute('x1', this._2dStart.x.toFixed(0));
        this._svgLine.setAttribute('y1', this._2dStart.y.toFixed(0));
        this._svgLine.setAttribute('x2', this._2dEnd.x.toFixed(0));
        this._svgLine.setAttribute('y2', this._2dEnd.y.toFixed(0));
    }

    getNode(){
        return this._svgDom;
    }

}