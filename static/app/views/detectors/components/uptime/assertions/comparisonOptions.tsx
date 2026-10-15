import type {SelectOption} from '@sentry/scraps/compactSelect';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {UptimeComparisonType} from 'sentry/views/detectors/components/uptime/types';

export const COMPARISON_OPTIONS: Array<
  SelectOption<UptimeComparisonType> & {symbol: string}
> = [
  {
    value: UptimeComparisonType.EQUALS,
    label: t('equal'),
    symbol: '=',
    trailingItems: <Text monospace>=</Text>,
  },
  {
    value: UptimeComparisonType.NOT_EQUAL,
    label: t('not equal'),
    symbol: '\u2260',
    trailingItems: <Text monospace>{'\u2260'}</Text>,
  },
  {
    value: UptimeComparisonType.LESS_THAN,
    label: t('less than'),
    symbol: '<',
    trailingItems: <Text monospace>{'<'}</Text>,
  },
  {
    value: UptimeComparisonType.GREATER_THAN,
    label: t('greater than'),
    symbol: '>',
    trailingItems: <Text monospace>{'>'}</Text>,
  },
  {
    value: UptimeComparisonType.ALWAYS,
    label: t('present'),
    symbol: '\u22A4',
    trailingItems: <Text monospace>{'\u22A4'}</Text>,
  },
  {
    value: UptimeComparisonType.NEVER,
    label: t('not present'),
    symbol: '\u2205',
    trailingItems: <Text monospace>{'\u2205'}</Text>,
  },
];

export const STRING_OPERAND_OPTIONS: Array<
  SelectOption<'literal' | 'glob'> & {symbol: string}
> = [
  {value: 'literal', label: t('Literal'), symbol: '""'},
  {value: 'glob', label: t('Glob Pattern'), symbol: '\u2217'},
];
