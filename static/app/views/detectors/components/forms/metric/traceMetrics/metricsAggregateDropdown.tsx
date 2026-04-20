import {useMemo} from 'react';
import styled from '@emotion/styled';

import {
  CompactSelect,
  type SelectKey,
  type SelectOption,
} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';

interface Props {
  onChange: (aggregation: string) => void;
  value: string;
  disabled?: boolean;
  metricType?: string;
}

/**
 * Controlled aggregation-operation dropdown (e.g. sum / avg / p95). Options
 * are derived from the metric's type — consumers pass the current metric
 * type to scope what's selectable.
 */
export function MetricsAggregateDropdown({value, metricType, onChange, disabled}: Props) {
  const options = useMemo(() => {
    const normalizedType = metricType?.toLowerCase() ?? '';
    return OPTIONS_BY_TYPE[normalizedType] ?? OPTIONS_BY_TYPE.distribution ?? [];
  }, [metricType]);

  return (
    <StyledSelect
      search
      options={options}
      value={value}
      onChange={(option: SelectOption<SelectKey>) => onChange(String(option.value))}
      disabled={disabled}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps}>
          {value || t('Select operation')}
        </OverlayTrigger.Button>
      )}
    />
  );
}

const StyledSelect = styled(CompactSelect)`
  width: 100%;
  max-width: 425px;
  & > button {
    width: 100%;
    font-weight: normal;
  }
`;
