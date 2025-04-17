import {t} from 'sentry/locale';
import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';

export const FILTER_MATCH_OPTIONS = [
  {value: DataConditionGroupLogicType.ALL, label: t('all')},
  {value: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT, label: t('any')},
  {value: DataConditionGroupLogicType.NONE, label: t('none')},
];

export enum AgeComparison {
  OLDER = 'older',
  NEWER = 'newer',
}

export const AGE_COMPARISON_CHOICES = [
  {
    value: AgeComparison.OLDER,
    label: 'older than',
  },
  {
    value: AgeComparison.NEWER,
    label: 'newer than',
  },
];
