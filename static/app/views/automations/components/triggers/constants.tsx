import {t} from 'sentry/locale';
import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';

export const TRIGGER_MATCH_OPTIONS = [
  {value: DataConditionGroupLogicType.ALL, label: t('all')},
  {value: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT, label: t('any')},
];
