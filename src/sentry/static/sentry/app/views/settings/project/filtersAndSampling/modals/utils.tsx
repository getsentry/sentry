import {css} from '@emotion/core';

import {t} from 'app/locale';
import {DynamicSamplingConditionOperator} from 'app/types/dynamicSampling';
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

export function getMatchFieldDescription(condition: DynamicSamplingConditionOperator) {
  switch (condition) {
    case DynamicSamplingConditionOperator.STR_EQUAL_NO_CASE:
      return {label: t('Match Environments'), description: 'this is a description'};
    case DynamicSamplingConditionOperator.GLOB_MATCH:
      return {label: t('Match Releases'), description: 'this is a description'};
    case DynamicSamplingConditionOperator.EQUAL:
      return {label: t('Match Users'), description: 'this is a description'};
    default:
      return {};
  }
}

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

export enum Category {
  RELEASES = 'releases',
  ENVIRONMENTS = 'environments',
  USERS = 'users',
  BROWSER_EXTENSIONS = 'browser_extensions',
  LOCALHOST = 'localhost',
  WEB_CRAWLERS = 'web_crawlers',
  LEGACY_BROWSERS = 'legacy_browsers',
}
