import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import moment from 'moment';

import {pinFilter, updateDateTime} from 'sentry/actionCreators/pageFilters';
import Button from 'sentry/components/button';
import TimeRangeSelector, {
  ChangeData,
} from 'sentry/components/organizations/timeRangeSelector';
import {getRelativeSummary} from 'sentry/components/organizations/timeRangeSelector/utils';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconCalendar, IconPin} from 'sentry/icons';
import {t} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';

type Props = Omit<
  React.ComponentProps<typeof TimeRangeSelector>,
  'organization' | 'start' | 'end' | 'utc' | 'relative' | 'onUpdate'
> & {
  router: WithRouterProps['router'];
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
};

function DatePageFilter({router, resetParamsOnChange, ...props}: Props) {
  const {selection, pinnedFilters} = useLegacyStore(PageFiltersStore);
  const organization = useOrganization();
  const {start, end, period, utc} = selection.datetime;

  const isDatePinned = pinnedFilters.has('datetime');

  const getDateSummary = (timeData: ChangeData) => {
    const {relativeOptions, defaultPeriod} = props;
    const {relative} = timeData;

    if (defined(start) && defined(end)) {
      const formattedStart = moment(timeData.start).local().format('ll');
      const formattedEnd = moment(timeData.end).local().format('ll');
      return `${formattedStart} - ${formattedEnd}`;
    }

    return getRelativeSummary(
      relative || defaultPeriod || DEFAULT_STATS_PERIOD,
      relativeOptions
    );
  };

  const handleUpdate = (timePeriodUpdate: ChangeData) => {
    const {relative, ...startEndUtc} = timePeriodUpdate;
    const newTimePeriod = {
      period: relative,
      ...startEndUtc,
    };

    updateDateTime(newTimePeriod, router, {save: true, resetParams: resetParamsOnChange});
  };

  const handlePinClick = () => {
    pinFilter('datetime', !isDatePinned);
  };

  return (
    <DateSelectorContainer>
      <StyledPageTimeRangeSelector
        organization={organization}
        start={start}
        end={end}
        relative={period}
        utc={utc}
        onUpdate={handleUpdate}
        label={<IconCalendar color="textColor" />}
        dateSummary={getDateSummary}
        {...props}
      />
      <PinButton
        aria-pressed={isDatePinned}
        aria-label={t('Pin')}
        onClick={handlePinClick}
        size="zero"
        icon={<IconPin size="xs" isSolid={isDatePinned} />}
        borderless
      />
    </DateSelectorContainer>
  );
}

const DateSelectorContainer = styled('div')`
  display: grid;
  gap: ${space(1)};
  align-items: center;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
`;

const StyledPageTimeRangeSelector = styled(PageTimeRangeSelector)`
  height: 40px;
  font-weight: 600;
`;

const PinButton = styled(Button)`
  display: block;
  color: ${p => p.theme.gray300};
  background: transparent;
`;

export default withRouter(DatePageFilter);
