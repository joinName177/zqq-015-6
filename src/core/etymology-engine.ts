import {
  IdiomProfile,
  KinshipResult,
  OracleChar,
  SemanticDNA,
  AllusionSource,
  SemanticEvolutionStep
} from './models';

export function calculateKinship(a: IdiomProfile, b: IdiomProfile): KinshipResult {
  // 1. DNA Vector distance
  const dOrig = a.dna.originalPercent - b.dna.originalPercent;
  const dExt = a.dna.extendedPercent - b.dna.extendedPercent;
  const dMeta = a.dna.metaphoricalPercent - b.dna.metaphoricalPercent;
  const euclideanDist = Math.sqrt(dOrig * dOrig + dExt * dExt + dMeta * dMeta);
  // Max possible dist is ~141.4
  const dnaVectorSimilarity = Math.max(0, Math.min(100, Math.round(100 - (euclideanDist / 141.4) * 100)));

  // 2. Sememe Jaccard overlap
  const setA = new Set(a.dna.coreSememes);
  const setB = new Set(b.dna.coreSememes);
  const sharedSememes: string[] = [];
  setA.forEach(s => {
    if (setB.has(s)) sharedSememes.push(s);
  });
  const unionCount = a.dna.coreSememes.length + b.dna.coreSememes.length || 1;
  const sememeScore = (sharedSememes.length / unionCount) * 100;

  // 3. Polarity match
  const polarityCompatibility = a.dna.polarity === b.dna.polarity;
  const polarityBonus = polarityCompatibility ? 15 : -10;

  // Composite Kinship Score (0 - 100)
  const rawScore = dnaVectorSimilarity * 0.45 + sememeScore * 0.45 + polarityBonus;
  const kinshipScore = Math.max(5, Math.min(99, Math.round(rawScore)));

  // Label & Verdict
  let relationshipLabel: KinshipResult['relationshipLabel'] = '远房微亲';
  let comparativeAnalysis = '';

  if (kinshipScore >= 80) {
    relationshipLabel = '同源近亲';
    comparativeAnalysis = `《${a.idiom}》与《${b.idiom}》在语义DNA结构和义原图谱上呈现极高度同构性。二者均以【${a.dna.polarity}】为感情基调，核心均指向【${sharedSememes.join('、') || '相近哲理'}】，可在修辞与论述场景中互为镜像互证。`;
  } else if (kinshipScore >= 60) {
    relationshipLabel = '异曲同工';
    comparativeAnalysis = `《${a.idiom}》与《${b.idiom}》在典故外壳上虽朝代与物象迥异，但底层比喻义与引申逻辑存在深度交叠（语义DNA相似度 ${dnaVectorSimilarity}%），呈现“殊途同归”的文化心理投射。`;
  } else if (kinshipScore >= 35) {
    relationshipLabel = '形似神离';
    comparativeAnalysis = `两成语在字面物象或语用场景上可能产生模糊关联，但剖析其语义DNA发现：《${a.idiom}》侧重【${a.dna.metaphoricalPercent}% 比喻义】，而《${b.idiom}》侧重【${b.dna.metaphoricalPercent}% 比喻义】，深层道德训诫重心截然不同。`;
  } else {
    relationshipLabel = '截然对立';
    comparativeAnalysis = `两成语无论在历史出处、义原构成（几乎无交集）还是情感褒贬极性上均处于不同象限。亲缘度仅为 ${kinshipScore}%，属于相去甚远的语义群落。`;
  }

  return {
    idiomA: a,
    idiomB: b,
    kinshipScore,
    dnaVectorSimilarity,
    sharedSememes,
    polarityCompatibility,
    relationshipLabel,
    comparativeAnalysis
  };
}

export function generateGenericIdiom(text: string): IdiomProfile {
  const chars = text.slice(0, 4).split('');
  const seed = chars.reduce((sum, c) => sum + c.charCodeAt(0), 0);

  const oracleChars: OracleChar[] = chars.map((c, i) => {
    return {
      char: c,
      pinyin: `zì-${i + 1}`,
      radical: '部首',
      scriptType: i % 2 === 0 ? '甲骨文' : '金文',
      glyphSvg: `<text x="50" y="65" font-size="44" text-anchor="middle" font-family="'Ma Shan Zheng', serif" fill="#c93b2b">${c}</text>`,
      originalMeaning: `在商周金石文献中，象形表意，指代天地人神之物象。`,
      pictographicExplanation: `构形源自远古刀刻契文或青铜铸范，保留原始象形线条。`
    };
  });

  const origP = 15 + (seed % 20);
  const extP = 25 + ((seed * 7) % 30);
  const metaP = 100 - origP - extP;

  const allusion: AllusionSource = {
    dynasty: ['春秋战国', '秦汉', '两晋', '唐代', '宋代'][seed % 5],
    classicBook: `《典籍辑佚卷·第${(seed % 30) + 1}》`,
    author: '古代佚名学者',
    yearApprox: '约公元前 300 年',
    historicalEvent: `先民观察社会人事变迁与自然物象互动，凝练为四字警策。`,
    originalAncientQuote: `“古之言者曰：${text}，盖取诸此也。”`
  };

  const evolutionPath: SemanticEvolutionStep[] = [
    { era: '先秦商周', meaning: '摹拟原始器物、祭祀或行止具象动作。', semanticCategory: '本义', contextSample: '原始契刻铭文记事' },
    { era: '汉魏晋唐', meaning: '文人敷衍成篇，自具体行为引申为处世策略或心理情状。', semanticCategory: '引申义', contextSample: '魏晋笔记志怪' },
    { era: '宋明现代', meaning: '泛化为成熟定型成语，高度抽象为人生哲理与社会讽喻。', semanticCategory: '比喻义', contextSample: '白话文与现代语篇' }
  ];

  const dna: SemanticDNA = {
    originalPercent: origP,
    extendedPercent: extP,
    metaphoricalPercent: metaP,
    polarity: seed % 3 === 0 ? '褒义' : seed % 3 === 1 ? '贬义' : '中性',
    coreSememes: ['行动', '警诫', '变化', '心境', '哲思']
  };

  return {
    id: `custom-${Date.now()}`,
    idiom: text,
    pinyin: 'chéng yǔ zhòng shēng',
    characters: oracleChars,
    allusion,
    evolutionPath,
    dna,
    modernDefinition: `四字结构凝炼凝缩了东方思维智慧，蕴含深厚的文化心智密码。`,
    syntacticRole: '常作宾语、定语或分句，具较强修辞概括力'
  };
}
