import {TreemapType} from 'sentry/views/preprod/types/appSizeTypes';

// TODO: Update to use theme
const COLORS = {
  gray900: '#0F0C13',
  gray700: '#1E1825',
  gray500: '#2D2435',
  gray300: '#4A3B57',
  gray200: '#ddd',
  gray100: 'hsla(270, 20%, 50%, 0.5)',
  border: 'hsla(0, 0.00%, 0.00%, 0.8)',
  shadow: 'hsla(0, 0.00%, 0.00%, 0.4)',
  purple: 'hsla(252, 85%, 60%, 0.7)',
  indigo: 'hsla(265, 71%, 43%, 0.7)',
  pink: 'hsla(324, 91%, 59%, 0.7)',
  salmon: 'hsla(2, 95%, 71%, 0.7)',
  orange: 'hsla(33, 100%, 61%, 0.7)',
  kiwi: 'hsla(69, 80%, 40%, 0.60)',
  cyan: 'hsla(192, 100%, 50%, 0.5)',
  white: '#FFFFFF',
} as const;

export const APP_SIZE_CATEGORY_INFO: Record<
  string,
  {color: string; displayName: string}
> = {
  [TreemapType.FILES]: {
    color: COLORS.gray100,
    displayName: 'Files',
  },
  [TreemapType.EXECUTABLES]: {
    color: COLORS.gray100,
    displayName: 'Executables',
  },
  [TreemapType.RESOURCES]: {
    color: COLORS.gray100,
    displayName: 'Resources',
  },
  [TreemapType.ASSETS]: {
    color: COLORS.gray100,
    displayName: 'Assets',
  },
  [TreemapType.MANIFESTS]: {
    color: COLORS.cyan,
    displayName: 'Manifests',
  },
  [TreemapType.SIGNATURES]: {
    color: COLORS.cyan,
    displayName: 'Signatures',
  },
  [TreemapType.FONTS]: {
    color: COLORS.cyan,
    displayName: 'Fonts',
  },
  [TreemapType.FRAMEWORKS]: {
    color: COLORS.pink,
    displayName: 'Frameworks',
  },
  [TreemapType.PLISTS]: {
    color: COLORS.pink,
    displayName: 'Plist Files',
  },
  [TreemapType.DYLD]: {
    color: COLORS.pink,
    displayName: 'Dynamic Libraries',
  },
  [TreemapType.MACHO]: {
    color: COLORS.pink,
    displayName: 'Mach-O Files',
  },
  [TreemapType.FUNCTION_STARTS]: {
    color: COLORS.pink,
    displayName: 'Function Starts',
  },
  [TreemapType.DEX]: {
    color: COLORS.kiwi,
    displayName: 'Dex',
  },
  [TreemapType.NATIVE_LIBRARIES]: {
    color: COLORS.kiwi,
    displayName: 'Native Libraries',
  },
  [TreemapType.COMPILED_RESOURCES]: {
    color: COLORS.kiwi,
    displayName: 'Compiled Resources',
  },
  [TreemapType.MODULES]: {
    color: COLORS.cyan,
    displayName: 'Modules',
  },
  [TreemapType.CLASSES]: {
    color: COLORS.cyan,
    displayName: 'Classes',
  },
  [TreemapType.METHODS]: {
    color: COLORS.cyan,
    displayName: 'Methods',
  },
  [TreemapType.STRINGS]: {
    color: COLORS.cyan,
    displayName: 'Strings',
  },
  [TreemapType.SYMBOLS]: {
    color: COLORS.cyan,
    displayName: 'Symbols',
  },
  [TreemapType.BINARY]: {
    color: COLORS.cyan,
    displayName: 'Binary Data',
  },
  [TreemapType.EXTERNAL_METHODS]: {
    color: COLORS.cyan,
    displayName: 'External Methods',
  },
  [TreemapType.OTHER]: {
    color: COLORS.purple,
    displayName: 'Other',
  },
  [TreemapType.UNMAPPED]: {
    color: COLORS.purple,
    displayName: 'Unmapped',
  },
};
