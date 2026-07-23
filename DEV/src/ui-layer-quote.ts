import { Vector3 } from "three";
import type { UiLayer } from "./ui-layer";
import { degToRad } from "three/src/math/MathUtils.js";

export class UiLayerQuote {
    
    protected _svgDom:SVGGElement;
    protected _parent:UiLayer;
    protected _color:string;
    protected _text:string;

    protected _3dStart:Vector3;
    protected _3dEnd:Vector3;
    protected _3dMiddle:Vector3;

    protected _visibilityNormal:Vector3;
    protected _visibilityAngle:number;
    
    protected _2dStart:Vector3 = new Vector3();
    protected _2dEnd:Vector3 = new Vector3();
    
    protected _svgStart:SVGUseElement;
    protected _svgEnd:SVGUseElement;
    protected _svgLine:SVGLineElement;
    protected _svgText:SVGTextElement;

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

        this._3dMiddle = new Vector3().lerpVectors(this._3dStart, this._3dEnd, 0.5);

        this._visibilityNormal = new Vector3(0,0,1);
        this._visibilityAngle = Math.PI*.25;
        if(node.visibilityCone){
            this._visibilityNormal.set(
                node.visibilityCone.axis.x,
                node.visibilityCone.axis.y,
                node.visibilityCone.axis.z
            )
            this._visibilityAngle = degToRad(node.visibilityCone.angle)*.5;
        }
        
        this._parent = parent;
        this._color = node.color;
        this._text = node.text;

        this.build();
    }
    
    build(){
        this._svgDom = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this._svgDom.classList.add("quote");
        this._svgDom.style.color = this._color;
        this._svgStart = document.createElementNS("http://www.w3.org/2000/svg", "use");
        this._svgStart.setAttribute("href", "#arrow");
        // this._svgStart.setAttribute('fill', "currentColor");
        this._svgEnd = document.createElementNS("http://www.w3.org/2000/svg", "use");
        this._svgEnd.setAttribute("href", "#arrow");
        // this._svgEnd.setAttribute('fill', this._color);
        this._svgLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        this._svgLine.setAttribute('stroke', "currentColor");
        this._svgLine.setAttribute('stroke-width', "3");
        
        this._svgText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        this._svgText.setAttribute('text-anchor', "middle");
        this._svgText.setAttribute('dominant-baseline', "central");
        this._svgText.innerHTML = this._text;

        this._svgDom.appendChild(this._svgStart);
        this._svgDom.appendChild(this._svgEnd);
        this._svgDom.appendChild(this._svgLine);
        this._svgDom.appendChild(this._svgText);
    }

    update(){
        // console.log(this._parent.getScreenCoord(this._3dStart));

        // console.log(this._parent.getAngleFromCamera(this._3dMiddle), this._visibilityNormal);
        let _angleToCamera = this._parent.getAngleFromCamera(this._3dMiddle).angleTo(this._visibilityNormal);
        // console.log(this._text, this._visibilityAngle, _angleToCamera);
        
        this._svgDom.classList.toggle("hidden", _angleToCamera > this._visibilityAngle)

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

        let _middleX = this._2dStart.x + (this._2dEnd.x - this._2dStart.x)*.5;
        let _middleY = this._2dStart.y + (this._2dEnd.y - this._2dStart.y)*.5;

        let textRot = (Math.abs(angleStart) > 90 && Math.abs(angleStart) < 270)  ? angleEnd : angleStart;
        this._svgText.setAttribute('transform', `translate(${_middleX} ${_middleY}) rotate(${textRot})`);

        // console.log(this._text, textRot, angleEnd, angleStart);
        
    }

    getNode(){
        return this._svgDom;
    }

}