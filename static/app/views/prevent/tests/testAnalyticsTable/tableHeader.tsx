import styled from '@emotion/styled';

import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {getArbitraryRelativePeriod} from 'sentry/components/timeRangeSelector/utils';
import {tct} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import SortableHeader from 'sentry/views/prevent/tests/testAnalyticsTable/sortableHeader';
import type {Column} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';
import {RIGHT_ALIGNED_FIELDS} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';

type TableHeaderParams = {
  column: Column;
  sort?: Sort;
};

function FlakyTestsTooltip() {
  const {preventPeriod} = usePreventContext();
  const dateRange = preventPeriod
    ? Object.values(getArbitraryRelativePeriod(preventPeriod))
    : '24 hours';

  return (
    <p>
      {tct(
        `Shows how often a flake occurs by tracking how many times a test goes from fail to pass or pass to fail on a given branch and commit within the [dateRange]`,
        {dateRange: <StyledDateRange>{dateRange}</StyledDateRange>}
      )}
      .
    </p>
  );
}

export const renderTableHeader = ({column, sort}: TableHeaderParams) => {
  const {key, name} = column;

  const alignment = RIGHT_ALIGNED_FIELDS.has(key) ? 'right' : 'left';
  const enableToggle = key === 'testName';

  return (
    <SortableHeader
      alignment={alignment}
      sort={sort}
      fieldName={key}
      label={name}
      enableToggle={enableToggle}
      {...(key === 'flakeRate' && {
        tooltip: <FlakyTestsTooltip />,
      })}
    />
  );
};

const StyledDateRange = styled('span')`
  text-transform: lowercase;
  font-weight: ${p => p.theme.fontWeight.bold};
`;
