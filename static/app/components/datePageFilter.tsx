import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import PageFilterDropdownButton from 'sentry/components/organizations/pageFilters/pageFilterDropdownButton';
import TimeRangeSelector, {
  ChangeData,
} from 'sentry/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import {IconCalendar} from 'sentry/icons';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
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
      const startString = start.toLocaleString('default', {
        month: 'short',
        day: 'numeric',
      });
      const endString = end.toLocaleString('default', {month: 'short', day: 'numeric'});
      label = `${startString} - ${endString}`;
    } else {
      label = period?.toUpperCase();
    }

    return (
      <PageFilterDropdownButton
        detached
        hideBottomBorder={false}
        isOpen={isOpen}
        icon={<IconCalendar />}
        highlighted={desyncedFilters.has('datetime')}
        {...getActorProps()}
      >
        <DropdownTitle>
          <TitleContainer>{label}</TitleContainer>
        </DropdownTitle>
      </PageFilterDropdownButton>
    );
  };

  return (
    <StyledPageTimeRangeSelector
      organization={organization}
      start={start}
      end={end}
      relative={period}
      utc={utc}
      onUpdate={handleUpdate}
      label={<IconCalendar color="textColor" />}
      customDropdownButton={customDropdownButton}
      showPin
      {...props}
    />
  );
}

const StyledPageTimeRangeSelector = styled(PageTimeRangeSelector)`
  flex-grow: 0;
  flex-shrink: 0;
  flex-basis: fit-content;
  position: relative;
  width: 100%;
  height: 100%;
  background: ${p => p.theme.background};
  border: none;
  box-shadow: none;
`;

const TitleContainer = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex: 1 1 0%;
`;

const DropdownTitle = styled('div')`
  display: flex;
  overflow: hidden;
  align-items: center;
  flex: 1;
`;

export default withRouter(DatePageFilter);
