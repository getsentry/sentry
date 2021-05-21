import capitalize from 'lodash/capitalize';

import {t} from 'app/locale';
import {ChunkType, MetaError} from 'app/types';

const REMARKS = {
  a: 'Annotated',
  x: 'Removed',
  s: 'Replaced',
  m: 'Masked',
  p: 'Pseudonymized',
  e: 'Encrypted',
};

const KNOWN_RULES = {
  '!limit': 'size limits',
  '!raw': 'raw payload',
  '!config': 'SDK configuration',
};

export function getTooltipText({
  remark = '',
  rule_id: rule = '',
}: Pick<ChunkType, 'remark' | 'rule_id'>) {
  const remark_title = REMARKS[remark];
  const rule_title = KNOWN_RULES[rule] || t('PII rule "%s"', rule);

  if (remark_title) {
    return t('%s because of %s', remark_title, rule_title);
  }

  return rule_title;
}

const formatErrorKind = (kind: string) => {
  return capitalize(kind.replace(/_/g, ' '));
};

export function getErrorMessage(error: MetaError) {
  const errorMessage: string[] = [];

  if (Array.isArray(error)) {
    if (error[0]) {
      errorMessage.push(formatErrorKind(error[0]));
    }

    if (error[1]?.reason) {
      errorMessage.push(`(${error[1].reason})`);
    }
  } else {
    errorMessage.push(formatErrorKind(error));
  }

  return errorMessage.join(' ');
}
