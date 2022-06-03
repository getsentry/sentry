import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import PageFilterDropdownButton from 'sentry/components/organizations/pageFilters/pageFilterDropdownButton';
import PageFilterPinIndicator from 'sentry/components/organizations/pageFilters/pageFilterPinIndicator';
import TimeRangeSelector, {
  ChangeData,
} from 'sentry/components/organizations/timeRangeSelector';
import {IconCalendar} from 'sentry/icons';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {
  getFormattedDate,
  DEFAULT_DAY_END_TIME,
  DEFAULT_DAY_START_TIME,
} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';

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

function DatePageFilter({router, resetParamsOnChange, ...props}: Props) {
  const {selection, desyncedFilters} = useLegacyStore(PageFiltersStore);
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

      const shouldShowTimes =
        startTimeFormatted !== DEFAULT_DAY_START_TIME ||
        endTimeFormatted !== DEFAULT_DAY_END_TIME;
      const format = shouldShowTimes ? 'MMM D, h:mma' : 'MMM D';

      const startString = getFormattedDate(start, format, {local: true});
      const endString = getFormattedDate(end, format, {local: true});

      label = `${startString} - ${endString}`;
    } else {
      label = period?.toUpperCase();
    }

    return (
      <PageFilterDropdownButton
        detached
        hideBottomBorder={false}
        isOpen={isOpen}
        highlighted={desyncedFilters.has('datetime')}
        data-test-id="global-header-timerange-selector"
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
      showPin
      detached
      {...props}
    />
  );
}

const TitleContainer = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex: 1 1 0%;
  margin-left: ${space(1)};
  text-align: left;
`;

const DropdownTitle = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  width: 100%;
`;

export default withRouter(DatePageFilter);
