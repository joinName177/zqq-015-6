import { IdiomProfile, KinshipResult } from '../core/models';
import { calculateKinship } from '../core/etymology-engine';
import { KinshipPort } from '../ports/kinship.port';

export class KinshipAdapter implements KinshipPort {
  compareIdioms(a: IdiomProfile, b: IdiomProfile): KinshipResult {
    return calculateKinship(a, b);
  }
}
