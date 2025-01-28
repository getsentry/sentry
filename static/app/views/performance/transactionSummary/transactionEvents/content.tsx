import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {LinkButton} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {TransactionSearchQueryBuilder} from 'sentry/components/performance/transactionSearchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import type {WebVital} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useRoutes} from 'sentry/utils/useRoutes';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {
  platformToPerformanceType,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

import type {SpanOperationBreakdownFilter} from '../filter';
import Filter, {filterToSearchConditions} from '../filter';
import type {SetStateAction} from '../types';

import EventsTable from './eventsTable';
import type {EventsDisplayFilterName} from './utils';
import {getEventsFilterOptions} from './utils';

type Props = {
  eventView: EventView;
  eventsDisplayFilterName: EventsDisplayFilterName;
  location: Location;
  onChangeEventsDisplayFilter: (eventsDisplayFilterName: EventsDisplayFilterName) => void;
  onChangeSpanOperationBreakdownFilter: (newFilter: SpanOperationBreakdownFilter) => void;
  organization: Organization;
  projectId: string;
  projects: Project[];
  setError: SetStateAction<string | undefined>;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  transactionName: string;
  percentileValues?: Record<EventsDisplayFilterName, number>;
  webVital?: WebVital;
};

export const TRANSACTIONS_LIST_TITLES: readonly string[] = [
  t('event id'),
  t('user'),
  t('operation duration'),
  t('total duration'),
  t('trace id'),
  t('timestamp'),
];

function EventsContent(props: Props) {
  const {
    location,
    organization,
    eventView: originalEventView,
    transactionName,
    spanOperationBreakdownFilter,
    webVital,
    setError,
    projectId,
    projects,
  } = props;
  const routes = useRoutes();
  const domainViewFilters = useDomainViewFilters();

  const {eventView, titles} = useMemo(() => {
    const eventViewClone = originalEventView.clone();
    const transactionsListTitles = TRANSACTIONS_LIST_TITLES.slice();
    const project = projects.find(p => p.id === projectId);

    const fields = [...eventViewClone.fields];

    if (webVital) {
      transactionsListTitles.splice(3, 0, webVital);
    }

    const spanOperationBreakdownConditions = filterToSearchConditions(
      spanOperationBreakdownFilter,
      location
    );

    if (spanOperationBreakdownConditions) {
      eventViewClone.query =
        `${eventViewClone.query} ${spanOperationBreakdownConditions}`.trim();
      transactionsListTitles.splice(2, 1, t('%s duration', spanOperationBreakdownFilter));
    }

    const platform = platformToPerformanceType(projects, eventViewClone.project);
    if (platform === ProjectPerformanceType.BACKEND) {
      const userIndex = transactionsListTitles.indexOf('user');
      if (userIndex > 0) {
        transactionsListTitles.splice(userIndex + 1, 0, 'http.method');
        fields.splice(userIndex + 1, 0, {field: 'http.method'});
      }
    }

    if (
      // only show for projects that already sent a profile
      // once we have a more compact design we will show this for
      // projects that support profiling as well
      project?.hasProfiles &&
      (organization.features.includes('profiling') ||
        organization.features.includes('continuous-profiling'))
    ) {
      transactionsListTitles.push(t('profile'));

      if (organization.features.includes('profiling')) {
        fields.push({field: 'profile.id'});
      }

      if (organization.features.includes('continuous-profiling')) {
        fields.push({field: 'profiler.id'});
        fields.push({field: 'thread.id'});
        fields.push({field: 'precise.start_ts'});
        fields.push({field: 'precise.finish_ts'});
      }
    }

    if (
      organization.features.includes('session-replay') &&
      project &&
      projectSupportsReplay(project)
    ) {
      transactionsListTitles.push(t('replay'));
      fields.push({field: 'replayId'});
    }

    eventViewClone.fields = fields;

    return {
      eventView: eventViewClone,
      titles: transactionsListTitles,
    };
  }, [
    originalEventView,
    location,
    organization,
    projects,
    projectId,
    spanOperationBreakdownFilter,
    webVital,
  ]);

  return (
    <Layout.Main fullWidth>
      <Search {...props} eventView={eventView} />
      <EventsTable
        eventView={eventView}
        organization={organization}
        routes={routes}
        location={location}
        setError={setError}
        columnTitles={titles}
        transactionName={transactionName}
        domainViewFilters={domainViewFilters}
      />
    </Layout.Main>
  );
}

function Search(props: Props) {
  const {
    eventView,
    location,
    organization,
    spanOperationBreakdownFilter,
    onChangeSpanOperationBreakdownFilter,
    eventsDisplayFilterName,
    onChangeEventsDisplayFilter,
    percentileValues,
  } = props;

  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    navigate({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  const query = decodeScalar(location.query.query, '');

  const eventsFilterOptions = getEventsFilterOptions(
    spanOperationBreakdownFilter,
    percentileValues
  );

  const handleDiscoverButtonClick = () => {
    trackAnalytics('performance_views.all_events.open_in_discover', {
      organization,
    });
  };

  const projectIds = useMemo(() => eventView.project?.slice(), [eventView.project]);

  return (
    <FilterActions>
      <Filter
        organization={organization}
        currentFilter={spanOperationBreakdownFilter}
        onChangeFilter={onChangeSpanOperationBreakdownFilter}
      />
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter />
      </PageFilterBar>
      <StyledSearchBarWrapper>
        <TransactionSearchQueryBuilder
          projects={projectIds}
          initialQuery={query}
          onSearch={handleSearch}
          searchSource="transaction_events"
        />
      </StyledSearchBarWrapper>
      <CompactSelect
        triggerProps={{prefix: t('Percentile')}}
        value={eventsDisplayFilterName}
        onChange={opt => onChangeEventsDisplayFilter(opt.value)}
        options={Object.entries(eventsFilterOptions).map(([name, filter]) => ({
          value: name as EventsDisplayFilterName,
          label: filter.label,
        }))}
      />
      <LinkButton
        to={eventView.getResultsViewUrlTarget(
          organization.slug,
          false,
          hasDatasetSelector(organization) ? SavedQueryDatasets.TRANSACTIONS : undefined
        )}
        onClick={handleDiscoverButtonClick}
      >
        {t('Open in Discover')}
      </LinkButton>
    </FilterActions>
  );
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(4, min-content);
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: auto auto 1fr auto auto;
  }
`;

const StyledSearchBarWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 1;
    grid-column: 1/6;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    order: initial;
    grid-column: auto;
  }
`;

export default EventsContent;
