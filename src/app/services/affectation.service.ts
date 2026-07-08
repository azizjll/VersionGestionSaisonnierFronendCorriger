import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Structure {
  id: number;
  nom: string;
  type: 'ESPACE_COMMERCIAL' | 'CENTRE_TECHNOLOGIQUE';
  adresse?: string;
    regionId: number;
  affectations?: any[];
}
@Injectable({
  providedIn: 'root'
})
export class AffectationService {

  private baseUrl = 'http://localhost:8080/api/affectations';

  constructor(private http: HttpClient) {}

  affecterSaisonnier(
    saisonnierId: number,
    structureId: number,
    campagneId: number
  ): Observable<any> {

    return this.http.post(`${this.baseUrl}/assign`, null, {
      params: {
        saisonnierId: saisonnierId,
        structureId: structureId,
        campagneId: campagneId
      }
    });

  }

    getByRegion(regionId:number):Observable<Structure[]>{

    return this.http.get<Structure[]>(`${this.baseUrl}/region/${regionId}`)
  }

   getStructuresByRegion(regionId: number): Observable<Structure[]> {
    return this.http.get<Structure[]>(`${this.baseUrl}/region/${regionId}`);
  }

}