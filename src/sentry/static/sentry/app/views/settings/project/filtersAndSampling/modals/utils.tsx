import {css} from '@emotion/core';

import {t} from 'app/locale';
import {LegacyBrowser} from 'app/types/dynamicSampling';
import theme from 'app/utils/theme';

export const modalCss = css`
  .modal-content {
    overflow: initial;
  }

  @media (min-width: ${theme.breakpoints[0]}) {
    .modal-dialog {
      width: 70%;
      margin-left: -35%;
    }
  }

  @media (min-width: ${theme.breakpoints[1]}) {
    .modal-dialog {
      width: 55%;
      margin-left: -27.5%;
    }
  }

  @media (min-width: ${theme.breakpoints[4]}) {
    .modal-dialog {
      width: 30%;
      margin-left: -15%;
    }
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
