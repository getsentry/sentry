import type {ReactNode} from 'react';
import {IconAdd} from '@sentry/icons/add';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {DurationUnit, FractionUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

/**
 * Freeform values let users pick a value that hasn't been sent yet, so a widget
 * can be set up before its data arrives.
 */

export interface FreeformTypeChoice<T extends string> {
  description: string;
  label: string;
  value: T;
}

export const FREEFORM_METRIC_TYPES: Array<FreeformTypeChoice<TraceMetricTypeValue>> = [
  {value: 'counter', label: t('Counter'), description: t('Counts occurrences')},
  {value: 'gauge', label: t('Gauge'), description: t('Tracks a value over time')},
  {
    value: 'distribution',
    label: t('Distribution'),
    description: t('Records values for percentiles'),
  },
];

/**
 * Units a freeform metric can be saved with.
 */
export const FREEFORM_METRIC_UNITS: Array<FreeformTypeChoice<string>> = [
  {value: NONE_UNIT, label: NONE_UNIT, description: t('No unit')},
  ...Object.values(DurationUnit).map(unit => ({
    value: unit,
    label: unit,
    description: t('Duration'),
  })),
  ...Object.values(SizeUnit).map(unit => ({
    value: unit,
    label: unit,
    description: t('Size'),
  })),
  ...Object.values(FractionUnit).map(unit => ({
    value: unit,
    label: unit,
    description: t('Fraction'),
  })),
];

/**
 * Returns trimmed name if it is a freeform name, otherwise returns null
 */
export function getFreeformName(
  name: string,
  existingNames: Iterable<string>
): string | null {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return null;
  }
  for (const existing of existingNames) {
    if (existing === trimmedName) {
      return null;
    }
  }
  return trimmedName;
}

export function FreeformOptionLabel({children}: {children: ReactNode}) {
  return (
    <Flex gap="sm" align="center" minWidth="0">
      <IconAdd size="xs" />
      <Text ellipsis>{children}</Text>
    </Flex>
  );
}

export function FreeformName({name}: {name: string}) {
  return <Text bold>{`"${name}"`}</Text>;
}

export function FreeformTypeDescription({children}: {children: ReactNode}) {
  return (
    <Text size="sm" variant="muted">
      {children}
    </Text>
  );
}

export function FreeformNewTag() {
  return <Tag variant="info">{t('New')}</Tag>;
}

export function AwaitingDataTag() {
  return <Tag variant="muted">{t('Awaiting data')}</Tag>;
}
