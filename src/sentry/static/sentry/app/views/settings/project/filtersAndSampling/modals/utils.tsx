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
      return {label: t('Match Enviroments'), description: 'this is a description'};
    case DynamicSamplingConditionOperator.GLOB_MATCH:
      return {label: t('Match Releases'), description: 'this is a description'};
    case DynamicSamplingConditionOperator.EQUAL:
      return {label: t('Match Users'), description: 'this is a description'};
    default:
      return {};
  }
}
