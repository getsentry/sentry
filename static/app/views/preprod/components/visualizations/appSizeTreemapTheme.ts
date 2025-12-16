import type {Theme} from '@emotion/react';
import color from 'color';

import {t} from 'sentry/locale';
import {TreemapType} from 'sentry/views/preprod/types/appSizeTypes';

interface AppSizeCategoryInfo {
  color: string;
  displayName: string;
  translucentColor?: string;
}

function createTranslucentColor(baseColor: string): string {
  return color(baseColor).alpha(0.6).string();
}

export function getAppSizeCategoryInfo(
  theme: Theme
): Record<string, AppSizeCategoryInfo> {
  const colorPalette = theme.chart.getColorPalette(7);

  const neutralColor = 'hsla(270, 20%, 50%, 0.5)';
  const groupColor1 = colorPalette[0];
  const groupColor2 = colorPalette[1];
  const groupColor3 = colorPalette[2];
  const groupColor4 = colorPalette[3];
  const groupColor5 = colorPalette[4];
  const groupColor6 = colorPalette[5];
  const groupColor7 = colorPalette[6];

  return {
    [TreemapType.FILES]: {
      color: neutralColor,
      translucentColor: createTranslucentColor(neutralColor),
      displayName: t('Files'),
    },
    [TreemapType.EXECUTABLES]: {
      color: groupColor1,
      translucentColor: createTranslucentColor(groupColor1),
      displayName: t('Executables'),
    },
    [TreemapType.RESOURCES]: {
      color: groupColor2,
      translucentColor: createTranslucentColor(groupColor2),
      displayName: t('Resources'),
    },
    [TreemapType.LOCALIZATIONS]: {
      color: groupColor2,
      translucentColor: createTranslucentColor(groupColor2),
      displayName: t('Localizations'),
    },
    [TreemapType.ASSETS]: {
      color: groupColor3,
      translucentColor: createTranslucentColor(groupColor3),
      displayName: t('Assets'),
    },
    [TreemapType.MANIFESTS]: {
      color: groupColor1,
      translucentColor: createTranslucentColor(groupColor1),
      displayName: t('Manifests'),
    },
    [TreemapType.SIGNATURES]: {
      color: groupColor1,
      translucentColor: createTranslucentColor(groupColor1),
      displayName: t('Signatures'),
    },
    [TreemapType.FONTS]: {
      color: groupColor4,
      translucentColor: createTranslucentColor(groupColor4),
      displayName: t('Fonts'),
    },
    [TreemapType.FRAMEWORKS]: {
      color: groupColor2,
      translucentColor: createTranslucentColor(groupColor2),
      displayName: t('Frameworks'),
    },
    [TreemapType.PLISTS]: {
      color: groupColor2,
      translucentColor: createTranslucentColor(groupColor2),
      displayName: t('Plist Files'),
    },
    [TreemapType.DYLD]: {
      color: groupColor1,
      translucentColor: createTranslucentColor(groupColor1),
      displayName: t('DYLD'),
    },
    [TreemapType.MACHO]: {
      color: groupColor2,
      translucentColor: createTranslucentColor(groupColor2),
      displayName: t('Mach-O Files'),
    },
    [TreemapType.FUNCTION_STARTS]: {
      color: groupColor2,
      translucentColor: createTranslucentColor(groupColor2),
      displayName: t('Function Starts'),
    },
    [TreemapType.DEX]: {
      color: groupColor1,
      translucentColor: createTranslucentColor(groupColor1),
      displayName: 'Dex', // not translated because it's an Android term
    },
    [TreemapType.NATIVE_LIBRARIES]: {
      color: groupColor6,
      translucentColor: createTranslucentColor(groupColor6),
      displayName: t('Native Libraries'),
    },
    [TreemapType.COMPILED_RESOURCES]: {
      color: groupColor3,
      translucentColor: createTranslucentColor(groupColor3),
      displayName: t('Compiled Resources'),
    },
    [TreemapType.MODULES]: {
      color: groupColor5,
      translucentColor: createTranslucentColor(groupColor5),
      displayName: t('Modules'),
    },
    [TreemapType.CLASSES]: {
      color: groupColor5,
      translucentColor: createTranslucentColor(groupColor5),
      displayName: t('Classes'),
    },
    [TreemapType.METHODS]: {
      color: groupColor5,
      translucentColor: createTranslucentColor(groupColor5),
      displayName: t('Methods'),
    },
    [TreemapType.STRINGS]: {
      color: groupColor5,
      translucentColor: createTranslucentColor(groupColor5),
      displayName: t('Strings'),
    },
    [TreemapType.SYMBOLS]: {
      color: groupColor5,
      translucentColor: createTranslucentColor(groupColor5),
      displayName: t('Symbols'),
    },
    [TreemapType.BINARY]: {
      color: groupColor5,
      translucentColor: createTranslucentColor(groupColor5),
      displayName: t('Binary Data'),
    },
    [TreemapType.EXTERNAL_METHODS]: {
      color: groupColor5,
      translucentColor: createTranslucentColor(groupColor5),
      displayName: t('External Methods'),
    },
    [TreemapType.OTHER]: {
      color: neutralColor,
      translucentColor: createTranslucentColor(neutralColor),
      displayName: t('Other'),
    },
    [TreemapType.UNMAPPED]: {
      color: neutralColor,
      translucentColor: createTranslucentColor(neutralColor),
      displayName: t('Unmapped'),
    },
    [TreemapType.EXTENSIONS]: {
      color: groupColor2,
      translucentColor: createTranslucentColor(groupColor2),
      displayName: t('Extensions'),
    },
    [TreemapType.CODE_SIGNATURE]: {
      color: groupColor1,
      translucentColor: createTranslucentColor(groupColor1),
      displayName: t('Code Signature'),
    },
    [TreemapType.AUDIO]: {
      color: groupColor7,
      translucentColor: createTranslucentColor(groupColor7),
      displayName: t('Audio'),
    },
  };
}

export function getAppSizeDiffCategoryInfo(
  theme: Theme
): Record<string, AppSizeCategoryInfo> {
  return {
    added: {
      color: theme.colors.red400,
      translucentColor: createTranslucentColor(theme.colors.red400),
      displayName: t('Added'),
    },
    increased: {
      color: theme.colors.red200,
      translucentColor: createTranslucentColor(theme.colors.red200),
      displayName: t('Increased'),
    },
    decreased: {
      color: theme.colors.green200,
      translucentColor: createTranslucentColor(theme.colors.green200),
      displayName: t('Decreased'),
    },
    removed: {
      color: theme.colors.green400,
      translucentColor: createTranslucentColor(theme.colors.green400),
      displayName: t('Removed'),
    },
  };
}
