import { IdiomProfile, KinshipResult } from '../core/models';

export interface KinshipPort {
  compareIdioms(a: IdiomProfile, b: IdiomProfile): KinshipResult;
}
