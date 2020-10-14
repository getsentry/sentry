import {t} from 'app/locale';
import {ChunkType} from 'app/types';

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
