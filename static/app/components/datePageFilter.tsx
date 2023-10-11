import {Fragment} from 'react';
import styled from '@emotion/styled';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import Datetime from 'sentry/components/dateTime';
import {DatePageFilter as NewDatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterDropdownButton from 'sentry/components/organizations/pageFilters/pageFilterDropdownButton';
import PageFilterPinIndicator from 'sentry/components/organizations/pageFilters/pageFilterPinIndicator';
import TimeRangeSelector, {
  ChangeData,
} from 'sentry/components/organizations/timeRangeSelector';
import {IconCalendar} from 'sentry/icons';
import {
  DEFAULT_DAY_END_TIME,
  DEFAULT_DAY_START_TIME,
  getFormattedDate,
} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

type Props = Omit<
  React.ComponentProps<typeof TimeRangeSelector>,
  'organization' | 'start' | 'end' | 'utc' | 'relative' | 'onUpdate'
> & {
  menuFooterMessage?: string;
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
};

function OldDatePageFilter({
  resetParamsOnChange,
  disabled,
  storageNamespace,
  ...props
}: Props) {
  const router = useRouter();
  const {selection, desyncedFilters} = usePageFilters();
  const organization = useOrganization();
  const {start, end, period, utc} = selection.datetime;

  const handleUpdate = (timePeriodUpdate: ChangeData) => {
    const {relative, ...startEndUtc} = timePeriodUpdate;
    const newTimePeriod = {
      period: relative,
      ...startEndUtc,
    };

    updateDateTime(newTimePeriod, router, {
      save: true,
      resetParams: resetParamsOnChange,
      storageNamespace,
    });
  };

  const customDropdownButton = ({getActorProps, isOpen}) => {
    let label;
    if (start && end) {
      const startTimeFormatted = getFormattedDate(start, 'HH:mm:ss', {local: true});
      const endTimeFormatted = getFormattedDate(end, 'HH:mm:ss', {local: true});

      const showDateOnly =
        startTimeFormatted === DEFAULT_DAY_START_TIME &&
        endTimeFormatted === DEFAULT_DAY_END_TIME;

      label = (
        <Fragment>
          <Datetime date={start} dateOnly={showDateOnly} />
          {' – '}
          <Datetime date={end} dateOnly={showDateOnly} />
        </Fragment>
      );
    } else {
      label = period?.toUpperCase();
    }

    return (
      <PageFilterDropdownButton
        detached
        disabled={disabled}
        hideBottomBorder={false}
        isOpen={isOpen}
        highlighted={desyncedFilters.has('datetime')}
        data-test-id="page-filter-timerange-selector"
        icon={
          <PageFilterPinIndicator filter="datetime">
            <IconCalendar />
          </PageFilterPinIndicator>
        }
        {...getActorProps()}
      >
        <TitleContainer>{label}</TitleContainer>
      </PageFilterDropdownButton>
    );
  };

  return (
    <TimeRangeSelector
      organization={organization}
      start={start}
      end={end}
      relative={period}
      utc={utc}
      onUpdate={handleUpdate}
      customDropdownButton={customDropdownButton}
      disabled={disabled}
      showPin
      detached
      {...props}
    />
  );
}

const TitleContainer = styled('div')`
  text-align: left;
  ${p => p.theme.overflowEllipsis}
`;

function DatePageFilter(props: Props) {
  const organization = useOrganization();

  if (organization.features.includes('new-page-filter')) {
    return <NewDatePageFilter {...props} />;
  }

  return <OldDatePageFilter {...props} />;
}

export default DatePageFilter;
