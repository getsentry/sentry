import {type ComponentProps, Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {
  DatePageFilter,
  type DatePageFilterProps,
} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DAY, SECOND} from 'sentry/utils/formatters';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {QUERY_DATE_RANGE_LIMIT} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

type Props = {
  moduleName: ModuleName;
  extraFilters?: React.ReactNode;
  onProjectChange?: ComponentProps<typeof ProjectPageFilter>['onChange'];
};

const CHANGE_PROJECT_TEXT = t('Make sure you have the correct project selected.');
const QUERY_DATE_RANGE_LIMIT_MS = QUERY_DATE_RANGE_LIMIT * DAY;

export function ModulePageFilterBar({moduleName, onProjectChange, extraFilters}: Props) {
  const {projects: allProjects} = useProjects();
  const organization = useOrganization();

  const hasDataWithSelectedProjects = useHasFirstSpan(moduleName);
  const hasDataWithAllProjects = useHasFirstSpan(moduleName, allProjects);
  const [showTooltip, setShowTooltip] = useState(false);

  const getDateDifferenceMs = memoizedDateDifference();

  const hasDateRangeQueryLimit = organization.features.includes(
    'insights-query-date-range-limit'
  );

  const handleClickAnywhereOnPage = () => {
    setShowTooltip(false);
  };

  useEffect(() => {
    if (!hasDataWithSelectedProjects && hasDataWithAllProjects) {
      const startTime = 0.5 * SECOND;
      const endTime = startTime + 5 * SECOND;
      // by adding a small delay to show the tooltip, this ensures the animation occurs and the tooltip popping up is more obvious
      setTimeout(() => setShowTooltip(true), startTime);
      setTimeout(() => setShowTooltip(false), endTime);
    }
    // We intentially do not include hasDataWithSelectedProjects in the dependencies,
    // as we only want to show the tooltip once per component load and not every time the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDataWithAllProjects]);

  useEffect(() => {
    document.addEventListener('click', handleClickAnywhereOnPage, {capture: true});
    return () => {
      document.removeEventListener('click', handleClickAnywhereOnPage);
    };
  }, []);

  const dateFilterProps: DatePageFilterProps = {};
  if (hasDateRangeQueryLimit) {
    dateFilterProps.relativeOptions = {
      '1h': t('Last 1 hour'),
      '24h': t('Last 24 hours'),
      '7d': t('Last 7 days'),
      '14d': <DisabledDateOption value={t('Last 14 days')} />,
      '30d': <DisabledDateOption value={t('Last 30 days')} />,
      '90d': <DisabledDateOption value={t('Last 90 days')} />,
    };
    dateFilterProps.maxPickableDays = QUERY_DATE_RANGE_LIMIT;
    dateFilterProps.isOptionDisabled = ({value}) => {
      if (value === 'absolute') {
        return false;
      }
      const dateDifferenceMs = getDateDifferenceMs(value);
      return dateDifferenceMs > QUERY_DATE_RANGE_LIMIT_MS;
    };
  }

  return (
    <Fragment>
      <PageFilterBar condensed>
        <Tooltip
          title={CHANGE_PROJECT_TEXT}
          forceVisible
          position="bottom-start"
          disabled={!showTooltip}
        >
          {/* TODO: Placing a DIV here is a hack, it allows the tooltip to close and the ProjectPageFilter to close at the same time,
          otherwise two clicks are required because of some rerendering/event propogation issues into the children */}
          <div style={{width: '100px', position: 'absolute', height: '100%'}} />
        </Tooltip>
        <ProjectPageFilter onChange={onProjectChange} />
        <EnvironmentPageFilter />
        <DatePageFilter {...dateFilterProps} />
      </PageFilterBar>
      {hasDataWithSelectedProjects && extraFilters}
    </Fragment>
  );
}

function DisabledDateOption({value}: {value: string}) {
  return (
    <DisabledDateOptionContainer>
      {value}
      <StyledIconBuisness />
    </DisabledDateOptionContainer>
  );
}

const DisabledDateOptionContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledIconBuisness = styled(IconBusiness)`
  margin-left: auto;
`;

// There's only a couple options, so might as well memoize this and not repeat it many times
const memoizedDateDifference = () => {
  const cache = {};
  return (value: string) => {
    if (value in cache) {
      return cache[value];
    }
    const {start, end} = parseStatsPeriod(value);
    const difference = moment(end).diff(moment(start));
    cache[value] = difference;
    return difference;
  };
};
