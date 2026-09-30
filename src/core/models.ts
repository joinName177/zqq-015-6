export interface OracleChar {
  char: string;
  pinyin: string;
  radical: string;
  scriptType: '甲骨文' | '金文' | '小篆';
  glyphSvg: string; // SVG path or stroke representation
  originalMeaning: string;
  pictographicExplanation: string;
}

export interface AllusionSource {
  dynasty: string;
  classicBook: string;
  author: string;
  yearApprox: string;
  historicalEvent: string;
  originalAncientQuote: string;
}

export interface SemanticEvolutionStep {
  era: string;
  meaning: string;
  semanticCategory: '本义' | '引申义' | '比喻义';
  contextSample: string;
}

export interface SemanticDNA {
  originalPercent: number;     // 本义占比
  extendedPercent: number;     // 引申义占比
  metaphoricalPercent: number; // 比喻义占比
  polarity: '褒义' | '中性' | '贬义';
  coreSememes: string[];
}

export interface IdiomProfile {
  id: string;
  idiom: string;
  pinyin: string;
  characters: OracleChar[];
  allusion: AllusionSource;
  evolutionPath: SemanticEvolutionStep[];
  dna: SemanticDNA;
  modernDefinition: string;
  syntacticRole: string;
}

export interface KinshipResult {
  idiomA: IdiomProfile;
  idiomB: IdiomProfile;
  kinshipScore: number; // 0 - 100
  dnaVectorSimilarity: number;
  sharedSememes: string[];
  polarityCompatibility: boolean;
  relationshipLabel: '同源近亲' | '异曲同工' | '形似神离' | '截然对立' | '远房微亲';
  comparativeAnalysis: string;
}
