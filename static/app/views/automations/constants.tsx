import {FieldValueType} from 'sentry/utils/fields';
import {ActionType} from 'sentry/views/alerts/rules/metric/types';

export const AUTOMATION_LIST_PAGE_LIMIT = 20;

const ACTION_TYPE_VALUES = Object.values(ActionType).sort();

export const AUTOMATION_FILTER_KEYS: Record<
  string,
  {
    description: string;
    valueType: FieldValueType;
    keywords?: string[];
    values?: string[];
  }
> = {
  name: {
    description: 'Name of the automation (exact match).',
    valueType: FieldValueType.STRING,
    keywords: ['name'],
  },
  action: {
    description: 'Action triggered by the automation.',
    valueType: FieldValueType.STRING,
    values: ACTION_TYPE_VALUES,
  },
};
