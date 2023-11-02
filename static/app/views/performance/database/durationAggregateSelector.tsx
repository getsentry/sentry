import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {AVAILABLE_DURATION_AGGREGATE_OPTIONS} from 'sentry/views/performance/database/settings';

interface Props {
  aggregate: string;
}

export function DurationAggregateSelector({aggregate}: Props) {
  const location = useLocation();

  const handleDurationFunctionChange = option => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        aggregate: option.value,
      },
    });
  };

  return (
    <StyledCompactSelect
      size="md"
      options={AVAILABLE_DURATION_AGGREGATE_OPTIONS}
      value={aggregate}
      onChange={handleDurationFunctionChange}
      triggerProps={{borderless: true, size: 'zero'}}
    />
  );
}

// TODO: Talk to UI folks about making this a built-in dropdown size if we end
// up using this element
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
