import {t} from 'sentry/locale';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

export const TRIGGER_MATCH_OPTIONS = [
  {value: DataConditionGroupLogicType.ALL, label: t('all')},
  {value: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT, label: t('any')},
];

export const TRIGGER_DATA_CONDITION_TYPES = [
  DataConditionType.FIRST_SEEN_EVENT,
  DataConditionType.REGRESSION_EVENT,
  DataConditionType.REAPPEARED_EVENT,
];
