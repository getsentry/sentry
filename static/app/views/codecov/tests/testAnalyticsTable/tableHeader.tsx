import type {Sort} from 'sentry/utils/discover/fields';
import SortableHeader from 'sentry/views/codecov/tests/testAnalyticsTable/sortableHeader';
import type {Column} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';
import {RIGHT_ALIGNED_FIELDS} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';

type TableHeaderParams = {
  column: Column;
  sort?: Sort;
};

type FlakyTestTooltipProps = {
  dateSelector: string;
};

function FlakyTestsTooltip({dateSelector}: FlakyTestTooltipProps) {
  return (
    <p>
      Shows how often a flake occurs by tracking how many times a test goes from fail to
      pass or pass to fail ona given branch and commit within the last {dateSelector}.
    </p>
  );
}

export const renderTableHeader = ({column, sort}: TableHeaderParams) => {
  const {key, name} = column;
  // TODO: adjust when the date selector is completed
  const dateSelector = '30 days';

  const alignment = RIGHT_ALIGNED_FIELDS.has(key) ? 'right' : 'left';

  return (
    <SortableHeader
      alignment={alignment}
      sort={sort}
      fieldName={key}
      label={name}
      {...(key === 'flakeRate' && {
        tooltip: <FlakyTestsTooltip dateSelector={dateSelector} />,
      })}
    />
  );
};
