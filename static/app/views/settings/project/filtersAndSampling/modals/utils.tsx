import {css} from '@emotion/react';

import {t} from 'app/locale';
import {DynamicSamplingInnerName, LegacyBrowser} from 'app/types/dynamicSampling';
import theme from 'app/utils/theme';

export const modalCss = css`
  [role='document'] {
    overflow: initial;
  }

  @media (min-width: ${theme.breakpoints[0]}) {
    width: 95%;
  }

  @media (min-width: ${theme.breakpoints[1]}) {
    width: 75%;
  }

  @media (min-width: ${theme.breakpoints[2]}) {
    width: 65%;
  }

  @media (min-width: ${theme.breakpoints[3]}) {
    width: 55%;
  }

  @media (min-width: ${theme.breakpoints[4]}) {
    width: 45%;
  }
`;

export const LEGACY_BROWSER_LIST = {
  [LegacyBrowser.IE_PRE_9]: {
    icon: 'internet-explorer',
    title: t('Internet Explorer Version 8 and lower'),
  },
  [LegacyBrowser.IE9]: {
    icon: 'internet-explorer',
    title: t('Internet Explorer Version 9'),
  },
  [LegacyBrowser.IE10]: {
    icon: 'internet-explorer',
    title: t('Internet Explorer Version 10'),
  },
  [LegacyBrowser.IE11]: {
    icon: 'internet-explorer',
    title: t('Internet Explorer Version 11'),
  },
  [LegacyBrowser.SAFARI_PRE_6]: {
    icon: 'safari',
    title: t('Safari Version 5 and lower'),
  },
  [LegacyBrowser.OPERA_PRE_15]: {
    icon: 'opera',
    title: t('Opera Version 14 and lower'),
  },
  [LegacyBrowser.OPERA_MINI_PRE_8]: {
    icon: 'opera',
    title: t('Opera Mini Version 8 and lower'),
  },
  [LegacyBrowser.ANDROID_PRE_4]: {
    icon: 'android',
    title: t('Android Version 3 and lower'),
  },
};

export enum Transaction {
  ALL = 'all',
  MATCH_CONDITIONS = 'match-conditions',
}

export function isLegacyBrowser(
  maybe: Array<string> | Array<LegacyBrowser>
): maybe is Array<LegacyBrowser> {
  return maybe.every(m => !!LEGACY_BROWSER_LIST[m]);
}

export function getMatchFieldPlaceholder(category: DynamicSamplingInnerName) {
  switch (category) {
    case DynamicSamplingInnerName.EVENT_LEGACY_BROWSER:
      return t('Match all selected legacy browsers below');
    case DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS:
      return t('Match all browser extensions');
    case DynamicSamplingInnerName.EVENT_LOCALHOST:
      return t('Match all localhosts');
    case DynamicSamplingInnerName.EVENT_WEB_CRAWLERS:
      return t('Match all web crawlers');
    case DynamicSamplingInnerName.EVENT_USER_ID:
    case DynamicSamplingInnerName.TRACE_USER_ID:
      return t('ex. 4711 (Multiline)');
    case DynamicSamplingInnerName.EVENT_USER_SEGMENT:
    case DynamicSamplingInnerName.TRACE_USER_SEGMENT:
      return t('ex. paid, common (Multiline)');
    case DynamicSamplingInnerName.TRACE_ENVIRONMENT:
    case DynamicSamplingInnerName.EVENT_ENVIRONMENT:
      return t('ex. prod or dev (Multiline)');
    case DynamicSamplingInnerName.TRACE_RELEASE:
    case DynamicSamplingInnerName.EVENT_RELEASE:
      return t('ex. 1* or [I3].[0-9].* (Multiline)');
    default:
      return '';
  }
}
