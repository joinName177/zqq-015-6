import { IdiomProfile } from '../core/models';

export interface IdiomRepositoryPort {
  getProfile(idiomText: string): Promise<IdiomProfile>;
  getPresets(): string[];
}
