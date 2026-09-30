import { IdiomProfile } from '../core/models';
import { IdiomRepositoryPort } from '../ports/idiom-repository.port';
import { generateGenericIdiom } from '../core/etymology-engine';

const RICH_IDIOMS: Record<string, IdiomProfile> = {
  '守株待兔': {
    id: 'id-szdt',
    idiom: '守株待兔',
    pinyin: 'shǒu zhū dài tù',
    characters: [
      {
        char: '守',
        pinyin: 'shǒu',
        radical: '宀',
        scriptType: '甲骨文',
        glyphSvg: `<circle cx="50" cy="30" r="15" fill="none" stroke="#b38b4d" stroke-width="3"/><path d="M 30,50 L 50,30 L 70,50 M 50,45 L 50,85 M 35,70 L 65,70" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '在房屋（宀）内以手（寸）执操防御，本义为戍守、守护。',
        pictographicExplanation: '甲骨文中“宀”如屋顶，“寸”如手，合意为在家中把守防备。'
      },
      {
        char: '株',
        pinyin: 'zhū',
        radical: '木',
        scriptType: '金文',
        glyphSvg: `<path d="M 50,15 L 50,85 M 25,45 L 75,45 M 30,75 L 50,45 L 70,75" fill="none" stroke="#b38b4d" stroke-width="3"/><circle cx="50" cy="78" r="6" fill="#c93b2b"/>`,
        originalMeaning: '树木露出地面的主干根部，即树桩。',
        pictographicExplanation: '从木，朱声。金文中突出刻画了树木扎根地表的基干节点。'
      },
      {
        char: '待',
        pinyin: 'dài',
        radical: '彳',
        scriptType: '小篆',
        glyphSvg: `<path d="M 30,25 L 30,75 M 30,50 L 45,35 M 55,20 L 75,20 M 65,20 L 65,80 M 50,60 L 80,60" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '停足于行道之上等待、等候。',
        pictographicExplanation: '“彳”代表道路，“寺”表持守，意为在十字路口驻足停留等候。'
      },
      {
        char: '兔',
        pinyin: 'tù',
        radical: '刀/免',
        scriptType: '甲骨文',
        glyphSvg: `<path d="M 40,25 Q 50,10 60,25 Q 70,40 55,50 Q 75,65 55,80 Q 35,75 40,55 Z" fill="none" stroke="#b38b4d" stroke-width="3"/><circle cx="48" cy="30" r="3" fill="#c93b2b"/>`,
        originalMeaning: '长耳短尾跳跃之哺乳动物。',
        pictographicExplanation: '甲骨文极其生动逼真地描绘出兔子长长的双耳与后蹲欲跃之形。'
      }
    ],
    allusion: {
      dynasty: '战国时期 (约公元前230年)',
      classicBook: '《韩非子·五蠹》',
      author: '韩非',
      yearApprox: '战国末期',
      historicalEvent: '宋人有耕者，田中有株。兔走触株，折颈而死。因释其耒而守株，冀复得兔。兔不可复得，而身为宋国笑。',
      originalAncientQuote: '“今欲以先王之政，治当世之民，皆守株之类也。”'
    },
    evolutionPath: [
      { era: '战国法家', meaning: '农夫守候在树桩旁期待兔子再次撞死（具体愚行）。', semanticCategory: '本义', contextSample: '《韩非子》寓言设喻' },
      { era: '汉唐诸子', meaning: '引申为不知变通、拘泥成法、不肯主动劳作者。', semanticCategory: '引申义', contextSample: '王充《论衡》引申治国之道' },
      { era: '明清现代', meaning: '高度概括为把偶发偶然当做必然、抱残守缺、妄图不劳而获的心态。', semanticCategory: '比喻义', contextSample: '现代社会讽喻与反思' }
    ],
    dna: {
      originalPercent: 12,
      extendedPercent: 28,
      metaphoricalPercent: 60,
      polarity: '贬义',
      coreSememes: ['侥幸心理', '墨守成规', '不劳而获', '经验主义', '缺乏应变']
    },
    modernDefinition: '比喻不主动努力，心存侥幸，希望得到意外收获；也比喻死守狭隘经验不知变通。',
    syntacticRole: '主要作谓语、定语、状语；含嘲讽贬义'
  },

  '刻舟求剑': {
    id: 'id-kzqj',
    idiom: '刻舟求剑',
    pinyin: 'kè zhōu qiú jiàn',
    characters: [
      {
        char: '刻',
        pinyin: 'kè',
        radical: '刂',
        scriptType: '金文',
        glyphSvg: `<path d="M 30,30 L 45,30 L 45,75 M 65,20 L 65,85 M 80,40 L 80,75" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '用锋利之金石刀具在硬物表面刻画镂削。',
        pictographicExplanation: '左边为“亥”，右边为立刀旁，表示以刀雕凿镂镂。'
      },
      {
        char: '舟',
        pinyin: 'zhōu',
        radical: '舟',
        scriptType: '甲骨文',
        glyphSvg: `<path d="M 35,20 L 35,80 Q 50,90 65,80 L 65,20 Q 50,10 35,20 Z M 35,45 L 65,45" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '刳木为舟，水行浮具。',
        pictographicExplanation: '甲骨文象船只俯视之形，两舷与舱板历历分明。'
      },
      {
        char: '求',
        pinyin: 'qiú',
        radical: '水/求',
        scriptType: '甲骨文',
        glyphSvg: `<path d="M 50,15 L 50,85 M 30,35 L 70,35 M 35,60 L 50,40 L 65,60 M 30,80 L 70,80" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '本为“裘”之本字，引申为探寻、摸索求取。',
        pictographicExplanation: '象兽皮毛衣之形，借指追求寻找。'
      },
      {
        char: '剑',
        pinyin: 'jiàn',
        radical: '刂',
        scriptType: '金文',
        glyphSvg: `<path d="M 45,15 L 45,85 M 35,30 L 55,30 M 30,70 L 60,70 M 75,25 L 75,80" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '双刃直身短兵器，王者护身之器。',
        pictographicExplanation: '左佥右刀，形象地绘出两侧有刃、中间有脊的利剑。'
      }
    ],
    allusion: {
      dynasty: '战国时期 (约公元前239年)',
      classicBook: '《吕氏春秋·察今》',
      author: '吕不韦及门客',
      yearApprox: '秦统一前夕',
      historicalEvent: '楚人有涉江者，其剑自舟中坠于水，遽契其舟曰：“是吾剑之所从坠。”舟止，从其所契者入水求之。舟已行矣，而剑不行，求剑若此，不亦惑乎？',
      originalAncientQuote: '“以故法为其国与此同。时已徙矣，而法不徙。以此为治，岂不难哉！”'
    },
    evolutionPath: [
      { era: '战国杂家', meaning: '在行进的船舷上刻痕迹试图捞出掉入江中的宝剑。', semanticCategory: '本义', contextSample: '《吕氏春秋》政治寓言' },
      { era: '秦汉大一统', meaning: '比喻以陈旧制度硬套变迁的新时代。', semanticCategory: '引申义', contextSample: '汉代政论' },
      { era: '现代语境', meaning: '泛指思想僵化、无视客观时间与空间条件流变，愚钝呆板。', semanticCategory: '比喻义', contextSample: '现代哲学与认识论批判' }
    ],
    dna: {
      originalPercent: 10,
      extendedPercent: 32,
      metaphoricalPercent: 58,
      polarity: '贬义',
      coreSememes: ['思想僵化', '静止孤立', '无视变动', '墨守成规', '方法错误']
    },
    modernDefinition: '比喻死守狭隘经验，拘泥固执，不知随时间空间客观条件的变化而变化。',
    syntacticRole: '通常作谓语、定语、状语；带贬义'
  },

  '卧薪尝胆': {
    id: 'id-wxcd',
    idiom: '卧薪尝胆',
    pinyin: 'wò xīn cháng dǎn',
    characters: [
      {
        char: '卧',
        pinyin: 'wò',
        radical: '卜/臣',
        scriptType: '小篆',
        glyphSvg: `<path d="M 30,25 L 30,75 M 20,40 L 40,40 M 55,20 L 75,50 L 55,80" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '伏卧、寝伏于榻木之上。',
        pictographicExplanation: '人俯视向下睡眠之态。'
      },
      {
        char: '薪',
        pinyin: 'xīn',
        radical: '艹',
        scriptType: '金文',
        glyphSvg: `<path d="M 25,25 L 75,25 M 40,15 L 40,35 M 60,15 L 60,35 M 35,50 L 65,80 M 65,50 L 35,80" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '草本植物之茎秆或粗柴，可用以炊火。',
        pictographicExplanation: '上从草，下从新，指柴薪柴草。'
      },
      {
        char: '尝',
        pinyin: 'cháng',
        radical: '口/小',
        scriptType: '小篆',
        glyphSvg: `<circle cx="50" cy="65" r="12" fill="none" stroke="#b38b4d" stroke-width="3"/><path d="M 35,25 L 65,25 M 50,15 L 50,45" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '以舌辨味，亲口品辨。',
        pictographicExplanation: '口旨会意，指亲自体验滋味。'
      },
      {
        char: '胆',
        pinyin: 'dǎn',
        radical: '月',
        scriptType: '小篆',
        glyphSvg: `<path d="M 30,20 L 30,80 M 30,20 Q 45,20 45,50 Q 45,80 30,80 M 60,30 L 75,30 M 67,20 L 67,80" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '人或动物分泌胆汁之器官，味极苦。',
        pictographicExplanation: '肉月旁，代指苦涩之胆囊。'
      }
    ],
    allusion: {
      dynasty: '春秋末期 (公元前496年)',
      classicBook: '《史记·越王勾践世家》',
      author: '司马迁',
      yearApprox: '西汉汉武帝年间记载',
      historicalEvent: '越王勾践反国，乃苦身焦思，置胆于坐，坐卧即仰胆，饮食亦尝胆也。曰：“女忘会稽之耻邪？”',
      originalAncientQuote: '“吴既赦越，越王勾践反国，乃苦身焦思，置胆于坐，坐卧即仰胆，饮食亦尝胆也。”'
    },
    evolutionPath: [
      { era: '春秋史籍', meaning: '勾践睡柴草悬苦胆亲自品尝以自警（身体苦修实录）。', semanticCategory: '本义', contextSample: '《史记》《越绝书》' },
      { era: '宋明理学', meaning: '士人借此砥砺心志，对抗安逸堕落，忍辱图存。', semanticCategory: '引申义', contextSample: '苏轼《拟孙权答曹操书》' },
      { era: '近现代', meaning: '形容人刻苦自励、忍辱负重、发愤图强、矢志复兴。', semanticCategory: '比喻义', contextSample: '民族自强励志语境' }
    ],
    dna: {
      originalPercent: 18,
      extendedPercent: 30,
      metaphoricalPercent: 52,
      polarity: '褒义',
      coreSememes: ['忍辱负重', '刻苦自励', '矢志复仇', '意志坚定', '逆境求生']
    },
    modernDefinition: '形容人刻苦自励，发愤图强，在极其艰难屈辱的逆境中坚韧不拔。',
    syntacticRole: '通常作谓语、定语、状语；含高度赞扬褒义'
  },

  '破釜沉舟': {
    id: 'id-pfcz',
    idiom: '破釜沉舟',
    pinyin: 'pò fǔ chén zhōu',
    characters: [
      {
        char: '破',
        pinyin: 'pò',
        radical: '石',
        scriptType: '小篆',
        glyphSvg: `<path d="M 30,25 L 45,25 L 35,75 M 55,30 L 75,50 M 75,30 L 55,75" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '碎裂坚石，砸破击碎。',
        pictographicExplanation: '左从石，右从皮，石裂为破。'
      },
      {
        char: '釜',
        pinyin: 'fǔ',
        radical: '金',
        scriptType: '金文',
        glyphSvg: `<circle cx="50" cy="40" r="20" fill="none" stroke="#b38b4d" stroke-width="3"/><path d="M 35,70 L 65,70 M 50,60 L 50,85" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '古代烹饪煮饭之铁质炊具。',
        pictographicExplanation: '上象锅盖腹深，下从金，古代之铁锅。'
      },
      {
        char: '沉',
        pinyin: 'chén',
        radical: '氵',
        scriptType: '小篆',
        glyphSvg: `<path d="M 25,25 C 30,35 20,45 25,55 M 25,75 L 35,65 M 50,30 L 75,50 L 50,75" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '物落入深水之下，没水。',
        pictographicExplanation: '从水，冗声，象物没入水中。'
      },
      {
        char: '舟',
        pinyin: 'zhōu',
        radical: '舟',
        scriptType: '甲骨文',
        glyphSvg: `<path d="M 35,20 L 35,80 Q 50,90 65,80 L 65,20 Z M 35,50 L 65,50" fill="none" stroke="#b38b4d" stroke-width="3"/>`,
        originalMeaning: '水行渡江之木船。',
        pictographicExplanation: '甲骨文舟船之象。'
      }
    ],
    allusion: {
      dynasty: '秦末巨鹿之战 (公元前207年)',
      classicBook: '《史记·项羽本纪》',
      author: '司马迁',
      yearApprox: '秦汉之交',
      historicalEvent: '项羽引兵渡漳水，悉沉船，破釜甑，烧庐舍，持三日粮，以示士卒必死，无一还心。',
      originalAncientQuote: '“项羽引兵渡漳水，悉沉船，破釜甑，烧庐舍，持三日粮，以示士卒必死，无一还心。”'
    },
    evolutionPath: [
      { era: '秦楚战火', meaning: '砸碎炊锅烧沉战船断绝后退生路（决死军令）。', semanticCategory: '本义', contextSample: '《史记》巨鹿之战' },
      { era: '汉唐军策', meaning: '引申为置之死地而后生、决不留退路的战略气魄。', semanticCategory: '引申义', contextSample: '历代兵书战论' },
      { era: '现代通用', meaning: '比喻下定孤注一掷的最大决心，不达目的誓不罢休。', semanticCategory: '比喻义', contextSample: '现代创业、考试决胜' }
    ],
    dna: {
      originalPercent: 15,
      extendedPercent: 30,
      metaphoricalPercent: 55,
      polarity: '褒义',
      coreSememes: ['断绝退路', '破釜决死', '坚定果断', '孤注一掷', '誓夺胜利']
    },
    modernDefinition: '比喻下定决心，不顾一切干到底，不留退路。',
    syntacticRole: '作谓语、宾语、状语；含果决勇毅褒义'
  }
};

export class DictionaryAdapter implements IdiomRepositoryPort {
  async getProfile(idiomText: string): Promise<IdiomProfile> {
    const trimmed = idiomText.trim().slice(0, 4);
    if (RICH_IDIOMS[trimmed]) {
      return RICH_IDIOMS[trimmed];
    }
    return generateGenericIdiom(trimmed || '守株待兔');
  }

  getPresets(): string[] {
    return ['守株待兔', '刻舟求剑', '卧薪尝胆', '破釜沉舟'];
  }
}
