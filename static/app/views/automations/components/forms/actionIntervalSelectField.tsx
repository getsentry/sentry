import styled from '@emotion/styled';

import SelectField, {
  type SelectFieldProps,
} from 'sentry/components/forms/fields/selectField';
import {t} from 'sentry/locale';

const FREQUENCY_OPTIONS = [
  {value: 5, label: t('5 minutes')},
  {value: 10, label: t('10 minutes')},
  {value: 30, label: t('30 minutes')},
  {value: 60, label: t('60 minutes')},
  {value: 180, label: t('3 hours')},
  {value: 720, label: t('12 hours')},
  {value: 1440, label: t('24 hours')},
  {value: 10080, label: t('1 week')},
  {value: 43200, label: t('30 days')},
];

type ActionIntervalSelectFieldProps = Partial<
  SelectFieldProps<{label: string; value: number}>
>;

export function ActionIntervalSelectField(props: ActionIntervalSelectFieldProps) {
  return (
    <EmbeddedSelectField
      required
      name="frequency"
      inline={false}
      clearable={false}
      options={FREQUENCY_OPTIONS}
      label={t('Action Interval')}
      {...props}
    />
  );
}

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeight.normal};
  text-transform: none;
`;
