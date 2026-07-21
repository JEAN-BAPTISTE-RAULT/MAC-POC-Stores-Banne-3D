
import { BoxGeometry, BufferGeometry, Material, Mesh, MeshStandardMaterial, Object3D } from 'three';

export class WorldBox3D extends Mesh {
    

    protected _length:number;
    protected _depth:number;
    protected _height:number;
    protected _material:MeshStandardMaterial;

    constructor(length:number, height:number, depth:number, material:MeshStandardMaterial){
        super(new BoxGeometry(length,height,depth,1,1), material);

        this._length = length;
        this._height = height;
        this._depth = depth;
        this._material = material;

        if(material.userData.texturesWidth){

            
            let repeat:number = 1/material.userData.texturesWidth;

            material.map?.repeat.set(repeat,repeat);
            material.normalMap?.repeat.set(repeat,repeat);
            material.roughnessMap?.repeat.set(repeat,repeat);
            
        }

        if(material.userData.texturesOffset){

            let offsetX:number = material.userData.texturesOffset.x/material.userData.texturesWidth;
            let offsetY:number = material.userData.texturesOffset.y/material.userData.texturesWidth;

            // console.log(material.userData.texturesOffset,offsetX,offsetY);
            material.map?.offset.set(offsetX,offsetY);
            material.normalMap?.offset.set(offsetX,offsetY);
            material.roughnessMap?.offset.set(offsetX,offsetY);
        }

        if(material.userData.texturesRotation) {
            // console.log(material.userData.texturesRotation);
            
            if(material.map) material.map.rotation = material.userData.texturesRotation;
            if(material.normalMap) material.normalMap.rotation = material.userData.texturesRotation;
            if(material.roughnessMap) material.roughnessMap.rotation = material.userData.texturesRotation;            
        }

        this.geometry.translate(
            this._length*.5,
            this._height*.5,
            this._depth*.5
        );
        this.geometry.computeBoundingBox();
    }


    public update = () => {
        

        console.log("WorldBox3D.update()");

        
        

        const uvAttribute = this.geometry.getAttribute('uv');
        const normalAttribute = this.geometry.getAttribute('normal');

        // console.log("\t",normalAttribute);

        // Parcourir toutes les faces (2 faces par plan)
        for (let i = 0; i < uvAttribute.count; i += 4) {
            const faceX = normalAttribute.getX(i); // Récupérer la position X du sommet
            const faceY = normalAttribute.getY(i); // Récupérer la position Y du sommet
            const faceZ = normalAttribute.getZ(i); // Récupérer la position Z du sommet

            // console.log("\t",faceX,faceY,faceZ);
            
            let uScale = 1;
            let vScale = 1;
            let uOffset = 0;
            let vOffset = 0;

            // On ajuste les UVs selon l'axe dominant
            if (faceX !== 0) {  // face sur le plan YZ (largeur et hauteur)
                uScale = this._depth;
                uOffset = this.position.z;
                vScale = this._height;
                vOffset = this.position.y;
            } else if (faceY !== 0) {  // face sur le plan XZ (profondeur et largeur)
                uScale = this._length;
                uOffset = this.position.x;
                vScale = this._depth;
                vOffset = this.position.z;
            } else if (faceZ !== 0) {  // face sur le plan XY (hauteur et largeur)
                uScale = this._length;
                uOffset = this.position.x;
                vScale = this._height;
                vOffset = this.position.y;
            }

            // Appliquer les nouvelles valeurs de UVs
            for (let j = 0; j < 4; j++) {
                const uIndex = i + j;
                const u = uvAttribute.getX(uIndex);
                const v = uvAttribute.getY(uIndex);

                uvAttribute.setXY(uIndex, u * uScale + uOffset, v * vScale + vOffset);
            }
        }

        // Mettre à jour les UVs après modifications
        uvAttribute.needsUpdate = true;
    }
}