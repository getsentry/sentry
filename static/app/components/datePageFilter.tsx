import {Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import Datetime from 'sentry/components/dateTime';
import PageFilterDropdownButton from 'sentry/components/organizations/pageFilters/pageFilterDropdownButton';
import PageFilterPinIndicator from 'sentry/components/organizations/pageFilters/pageFilterPinIndicator';
import TimeRangeSelector, {
  ChangeData,
} from 'sentry/components/organizations/timeRangeSelector';
import {IconCalendar} from 'sentry/icons';
import space from 'sentry/styles/space';
import {
  DEFAULT_DAY_END_TIME,
  DEFAULT_DAY_START_TIME,
  getFormattedDate,
} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = Omit<
  React.ComponentProps<typeof TimeRangeSelector>,
  'organization' | 'start' | 'end' | 'utc' | 'relative' | 'onUpdate'
> &
  WithRouterProps & {
    /**
     * Reset these URL params when we fire actions (custom routing only)
     */
    resetParamsOnChange?: string[];
  };

function DatePageFilter({router, resetParamsOnChange, disabled, ...props}: Props) {
  const {selection, desyncedFilters} = usePageFilters();
  const organization = useOrganization();
  const {start, end, period, utc} = selection.datetime;

  const handleUpdate = (timePeriodUpdate: ChangeData) => {
    const {relative, ...startEndUtc} = timePeriodUpdate;
    const newTimePeriod = {
      period: relative,
      ...startEndUtc,
    };

    updateDateTime(newTimePeriod, router, {save: true, resetParams: resetParamsOnChange});
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
        {...getActorProps()}
      >
        <DropdownTitle>
          <PageFilterPinIndicator filter="datetime">
            <IconCalendar />
          </PageFilterPinIndicator>
          <TitleContainer>{label}</TitleContainer>
        </DropdownTitle>
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
  flex: 1 1 0%;
  margin-left: ${space(1)};
  text-align: left;
  ${p => p.theme.overflowEllipsis}
`;

const DropdownTitle = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  width: max-content;
  min-width: 0;
`;

export default withRouter(DatePageFilter);
