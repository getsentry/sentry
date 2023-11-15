import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useAvailableDurationAggregates} from 'sentry/views/performance/database/useAvailableDurationAggregates';

export function DurationAggregateSelector() {
  const location = useLocation();

  const {selectedAggregate, availableAggregates} = useAvailableDurationAggregates();

  // If only one aggregate is available, render a plain string
  if (availableAggregates.length === 1) {
    return DURATION_AGGREGATE_LABELS[selectedAggregate];
  }

  const handleDurationFunctionChange = option => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        aggregate: option.value,
      },
    });
  };

  // If multiple aggregates are available, render a dropdown list
  return (
    <StyledCompactSelect
      size="md"
      options={availableAggregates.map(availableAggregate => ({
        value: availableAggregate,
        label: DURATION_AGGREGATE_LABELS[availableAggregate],
      }))}
      value={selectedAggregate}
      onChange={handleDurationFunctionChange}
      triggerProps={{borderless: true, size: 'zero'}}
    />
  );
}

const DURATION_AGGREGATE_LABELS = {
  avg: t('Average Duration'),
  max: t('Max Duration'),
  p50: t('Duration p50'),
  p75: t('Duration p75'),
  p95: t('Duration p95'),
  p99: t('Duration p99'),
};

// TODO: Talk to UI folks about making this a built-in dropdown size, we use this in a few places
const StyledCompactSelect = styled(CompactSelect)`
  text-align: left;
  font-weight: normal;
  margin: -${space(0.5)} -${space(1)} -${space(0.25)};
  min-width: 0;

  button {
    padding: ${space(0.5)} ${space(1)};
    font-size: ${p => p.theme.fontSizeLarge};
  }
`;
