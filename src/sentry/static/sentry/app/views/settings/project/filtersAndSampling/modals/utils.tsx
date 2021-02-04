import {css} from '@emotion/core';

import {t} from 'app/locale';
import theme from 'app/utils/theme';

export const modalCss = css`
  .modal-content {
    overflow: initial;
  }

  @media (min-width: ${theme.breakpoints[0]}) {
    .modal-dialog {
      width: 35%;
      margin-left: -17.5%;
    }
  }
`;

export const LEGACY_BROWSER_LIST = {
  ie_pre_9: {
    icon: 'internet-explorer',
    title: t('Internet Explorer Version 8 and lower'),
  },
  ie9: {
    icon: 'internet-explorer',
    title: t('Internet Explorer Version 9'),
  },
  ie10: {
    icon: 'internet-explorer',
    title: t('Internet Explorer Version 10'),
  },
  ie11: {
    icon: 'internet-explorer',
    title: t('Internet Explorer Version 11'),
  },
  safari_pre_6: {
    icon: 'safari',
    title: t('Safari Version 5 and lower'),
  },
  opera_pre_15: {
    icon: 'opera',
    title: t('Opera Version 14 and lower'),
  },
  opera_mini_pre_8: {
    icon: 'opera',
    title: t('Opera Mini Version 8 and lower'),
  },
  android_pre_4: {
    icon: 'android',
    title: t('Android Version 3 and lower'),
  },
};

export enum Transaction {
  ALL = 'all',
  MATCH_CONDITIONS = 'match-conditions',
}
