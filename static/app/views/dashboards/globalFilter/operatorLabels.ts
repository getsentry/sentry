import {OP_LABELS as NATIVE_OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';

export enum CustomOperator {
  BETWEEN = 'between',
}

export type Operator = TermOperator | CustomOperator;

const OPERATOR_LABELS: Partial<Record<Operator, string>> = {
  [CustomOperator.BETWEEN]: t('between'),
  [TermOperator.GREATER_THAN_EQUAL]: '\u2265',
  [TermOperator.LESS_THAN_EQUAL]: '\u2264',
};

export function getOperatorLabel(operator: Operator): string {
  return OPERATOR_LABELS[operator] ?? NATIVE_OP_LABELS[operator as TermOperator];
}
