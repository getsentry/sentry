import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {getArbitraryRelativePeriod} from 'sentry/components/timeRangeSelector/utils';
import {tct} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import SortableHeader from 'sentry/views/prevent/tests/testAnalyticsTable/sortableHeader';
import type {Column} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';
import {RIGHT_ALIGNED_FIELDS} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';

type TableHeaderParams = {
  column: Column;
  isMainOrDefaultBranch: boolean;
  sort?: Sort;
};

function FlakyTestsTooltip() {
  const {preventPeriod} = usePreventContext();
  const dateRange = preventPeriod
    ? Object.values(getArbitraryRelativePeriod(preventPeriod)).join(', ')
    : '24 hours';

  return tct(
    `Shows how often a flake occurs by tracking how many times a test goes from fail to pass or pass to fail on a given branch and commit within the [dateRange].`,
    {dateRange: <strong>{dateRange.toLowerCase()}</strong>}
  );
}

export const renderTableHeader = ({
  column,
  isMainOrDefaultBranch,
  sort,
}: TableHeaderParams) => {
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
      {...(key === 'flakeRate' &&
        isMainOrDefaultBranch && {
          tooltip: <FlakyTestsTooltip />,
        })}
    />
  );
};
