import type {ReactNode} from 'react';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {TriggerProps} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';

export const QUERY_SPEEDS = ['normal', 'faster'] as const;

export type QuerySpeed = (typeof QUERY_SPEEDS)[number];

const QUERY_SPEED_LABELS: Record<QuerySpeed, string> = {
  normal: t('Balanced Querying'),
  faster: t('Fast Querying'),
};

const QUERY_SPEED_OPTIONS: Array<SelectOption<QuerySpeed>> = [
  {
    value: 'normal',
    label: QUERY_SPEED_LABELS.normal,
    details: t('Balances speed and accuracy'),
  },
  {
    value: 'faster',
    label: QUERY_SPEED_LABELS.faster,
    details: t('Faster with reduced accuracy'),
  },
];

export function getQuerySpeedLabel(speed: QuerySpeed): string {
  return QUERY_SPEED_LABELS[speed];
}

type QuerySpeedMenuProps = {
  onChange: (speed: QuerySpeed) => void;
  className?: string;
  disabled?: boolean;
  menuWidth?: number | string;
  trigger?: (props: TriggerProps, isOpen: boolean) => ReactNode;
  value?: QuerySpeed;
};

export function QuerySpeedMenu({
  className,
  disabled,
  menuWidth,
  onChange,
  trigger,
  value,
}: QuerySpeedMenuProps) {
  return (
    <CompactSelect
      className={className}
      disabled={disabled}
      menuTitle={t('Query Speed')}
      menuWidth={menuWidth}
      onChange={option => {
        onChange(option.value);
      }}
      options={QUERY_SPEED_OPTIONS}
      trigger={trigger}
      value={value}
    />
  );
}
