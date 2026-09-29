import './ui/styles.css';
import { DictionaryAdapter } from './adapters/dictionary.adapter';
import { KinshipAdapter } from './adapters/kinship.adapter';
import { IdiomProfile, KinshipResult } from './core/models';
import { renderIdiomApp } from './ui/app';

const dictAdapter = new DictionaryAdapter();
const kinshipAdapter = new KinshipAdapter();

let currentMode: 'single' | 'compare' = 'single';
let currentProfile: IdiomProfile;
let compareA = '守株待兔';
let compareB = '刻舟求剑';
let kinshipResult: KinshipResult | null = null;

const rootEl = document.getElementById('app')!;

async function init() {
  currentProfile = await dictAdapter.getProfile('守株待兔');
  const profA = await dictAdapter.getProfile(compareA);
  const profB = await dictAdapter.getProfile(compareB);
  kinshipResult = kinshipAdapter.compareIdioms(profA, profB);
  refreshView();
}

function refreshView() {
  renderIdiomApp(
    rootEl,
    currentProfile,
    dictAdapter.getPresets(),
    currentMode,
    kinshipResult,
    compareA,
    compareB,
    {
      onSearch: async (text: string) => {
        currentProfile = await dictAdapter.getProfile(text);
        kinshipResult = null;
        refreshView();
      },
      onCompare: async (textA: string, textB: string) => {
        compareA = textA;
        compareB = textB;
        const pA = await dictAdapter.getProfile(textA);
        const pB = await dictAdapter.getProfile(textB);
        kinshipResult = kinshipAdapter.compareIdioms(pA, pB);
        refreshView();
      },
      onSwitchMode: (mode: 'single' | 'compare') => {
        currentMode = mode;
        refreshView();
      }
    }
  );
}

init();
