import type {Theme} from '@emotion/react';
import color from 'color';

import {t} from 'sentry/locale';
import {TreemapType} from 'sentry/views/preprod/types/appSizeTypes';

export function getAppSizeCategoryInfo(
  theme: Theme
): Record<string, {color: string; displayName: string; headerColor?: string}> {
  const createHeaderColor = (baseColor: string): string => {
    return color(baseColor).alpha(0.6).string();
  };

  return {
    [TreemapType.FILES]: {
      color: 'hsla(270, 20%, 50%, 0.5)',
      headerColor: createHeaderColor('hsla(270, 20%, 50%, 0.5)'),
      displayName: t('Files'),
    },
    [TreemapType.EXECUTABLES]: {
      color: theme.blue300,
      headerColor: createHeaderColor(theme.blue300),
      displayName: t('Executables'),
    },
    [TreemapType.RESOURCES]: {
      color: theme.pink400,
      headerColor: createHeaderColor(theme.pink400),
      displayName: t('Resources'),
    },
    [TreemapType.ASSETS]: {
      color: theme.green300,
      headerColor: createHeaderColor(theme.green300),
      displayName: t('Assets'),
    },
    [TreemapType.MANIFESTS]: {
      color: theme.blue300,
      headerColor: createHeaderColor(theme.blue300),
      displayName: t('Manifests'),
    },
    [TreemapType.SIGNATURES]: {
      color: theme.blue300,
      headerColor: createHeaderColor(theme.blue300),
      displayName: t('Signatures'),
    },
    [TreemapType.FONTS]: {
      color: theme.purple400,
      headerColor: createHeaderColor(theme.purple400),
      displayName: t('Fonts'),
    },
    [TreemapType.FRAMEWORKS]: {
      color: theme.pink400,
      headerColor: createHeaderColor(theme.pink400),
      displayName: t('Frameworks'),
    },
    [TreemapType.PLISTS]: {
      color: theme.pink400,
      headerColor: createHeaderColor(theme.pink400),
      displayName: t('Plist Files'),
    },
    [TreemapType.DYLD]: {
      color: theme.blue400,
      headerColor: createHeaderColor(theme.blue400),
      displayName: t('Dynamic Libraries'),
    },
    [TreemapType.MACHO]: {
      color: theme.pink400,
      headerColor: createHeaderColor(theme.pink400),
      displayName: t('Mach-O Files'),
    },
    [TreemapType.FUNCTION_STARTS]: {
      color: theme.pink400,
      headerColor: createHeaderColor(theme.pink400),
      displayName: t('Function Starts'),
    },
    [TreemapType.DEX]: {
      color: theme.blue300,
      headerColor: createHeaderColor(theme.blue300),
      displayName: 'Dex', // not translated because it's an Android term
    },
    [TreemapType.NATIVE_LIBRARIES]: {
      color: theme.yellow300,
      headerColor: createHeaderColor(theme.yellow300),
      displayName: t('Native Libraries'),
    },
    [TreemapType.COMPILED_RESOURCES]: {
      color: theme.green300,
      headerColor: createHeaderColor(theme.green300),
      displayName: t('Compiled Resources'),
    },
    [TreemapType.MODULES]: {
      color: theme.blue400,
      headerColor: createHeaderColor(theme.blue400),
      displayName: t('Modules'),
    },
    [TreemapType.CLASSES]: {
      color: theme.blue400,
      headerColor: createHeaderColor(theme.blue400),
      displayName: t('Classes'),
    },
    [TreemapType.METHODS]: {
      color: theme.blue400,
      headerColor: createHeaderColor(theme.blue400),
      displayName: t('Methods'),
    },
    [TreemapType.STRINGS]: {
      color: theme.blue400,
      headerColor: createHeaderColor(theme.blue400),
      displayName: t('Strings'),
    },
    [TreemapType.SYMBOLS]: {
      color: theme.blue400,
      headerColor: createHeaderColor(theme.blue400),
      displayName: t('Symbols'),
    },
    [TreemapType.BINARY]: {
      color: theme.blue400,
      headerColor: createHeaderColor(theme.blue400),
      displayName: t('Binary Data'),
    },
    [TreemapType.EXTERNAL_METHODS]: {
      color: theme.blue400,
      headerColor: createHeaderColor(theme.blue400),
      displayName: t('External Methods'),
    },
    [TreemapType.OTHER]: {
      color: theme.gray300,
      headerColor: createHeaderColor(theme.gray300),
      displayName: t('Other'),
    },
    [TreemapType.UNMAPPED]: {
      color: theme.gray300,
      headerColor: createHeaderColor(theme.gray300),
      displayName: t('Unmapped'),
    },
    [TreemapType.EXTENSIONS]: {
      color: theme.pink400,
      headerColor: createHeaderColor(theme.pink400),
      displayName: t('Extensions'),
    },
    [TreemapType.CODE_SIGNATURE]: {
      color: theme.blue300,
      headerColor: createHeaderColor(theme.blue300),
      displayName: t('Code Signature'),
    },
  };
}
