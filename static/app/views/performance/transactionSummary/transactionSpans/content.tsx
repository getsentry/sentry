import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import CompactSelect from 'sentry/components/compactSelect';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import SuspectSpansQuery from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import useProjects from 'sentry/utils/useProjects';

import {SetStateAction} from '../types';

import OpsFilter from './opsFilter';
import SuspectSpansTable from './suspectSpansTable';
import {SpanSort, SpansTotalValues} from './types';
import {
  getSuspectSpanSortFromEventView,
  getTotalsView,
  SPAN_RELATIVE_PERIODS,
  SPAN_RETENTION_DAYS,
  SPAN_SORT_OPTIONS,
  SPAN_SORT_TO_FIELDS,
} from './utils';

const ANALYTICS_VALUES = {
  spanOp: (organization: Organization, value: string | undefined) =>
    trackAdvancedAnalyticsEvent('performance_views.spans.change_op', {
      organization,
      operation_name: value,
    }),
  sort: (organization: Organization, value: string | undefined) =>
    trackAdvancedAnalyticsEvent('performance_views.spans.change_sort', {
      organization,
      sort_column: value,
    }),
};

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projectId: string;
  setError: SetStateAction<string | undefined>;
  transactionName: string;
};

function SpansContent(props: Props) {
  const {location, organization, eventView, projectId, transactionName} = props;
  const query = decodeScalar(location.query.query, '');

  function handleChange(key: string) {
    return function (value: string | undefined) {
      ANALYTICS_VALUES[key]?.(organization, value);

      const queryParams = normalizeDateTimeParams({
        ...(location.query || {}),
        [key]: value,
      });

      // do not propagate pagination when making a new search
      const toOmit = ['cursor'];
      if (!defined(value)) {
        toOmit.push(key);
      }
      const searchQueryParams = omit(queryParams, toOmit);

      browserHistory.push({
        ...location,
        query: searchQueryParams,
      });
    };
  }

  const spanOp = decodeScalar(location.query.spanOp);
  const spanGroup = decodeScalar(location.query.spanGroup);
  const sort = getSuspectSpanSortFromEventView(eventView);
  const spansView = getSpansEventView(eventView, sort.field);
  const totalsView = getTotalsView(eventView);

  const {projects} = useProjects();

  return (
    <Layout.Main fullWidth>
      <FilterActions>
        <OpsFilter
          location={location}
          eventView={eventView}
          organization={organization}
          handleOpChange={handleChange('spanOp')}
          transactionName={transactionName}
        />
        <PageFilterBar condensed>
          <EnvironmentPageFilter />
          <DatePageFilter
            alignDropdown="left"
            maxPickableDays={SPAN_RETENTION_DAYS}
            relativeOptions={SPAN_RELATIVE_PERIODS}
          />
        </PageFilterBar>
        <StyledSearchBar
          organization={organization}
          projectIds={eventView.project}
          query={query}
          fields={eventView.fields}
          onSearch={handleChange('query')}
        />
        <CompactSelect
          value={sort.field}
          options={SPAN_SORT_OPTIONS.map(opt => ({value: opt.field, label: opt.label}))}
          onChange={opt => handleChange('sort')(opt.value)}
          triggerProps={{prefix: sort.prefix}}
          triggerLabel={sort.label}
        />
      </FilterActions>
      <DiscoverQuery
        eventView={totalsView}
        orgSlug={organization.slug}
        location={location}
        referrer="api.performance.transaction-spans"
        cursor="0:0:1"
        noPagination
        useEvents
      >
        {({tableData}) => {
          const totals: SpansTotalValues | null =
            (tableData?.data?.[0] as SpansTotalValues | undefined) ?? null;
          return (
            <SuspectSpansQuery
              location={location}
              orgSlug={organization.slug}
              eventView={spansView}
              limit={10}
              perSuspect={0}
              spanOps={defined(spanOp) ? [spanOp] : []}
              spanGroups={defined(spanGroup) ? [spanGroup] : []}
            >
              {({suspectSpans, isLoading, pageLinks}) => (
                <Fragment>
                  <SuspectSpansTable
                    location={location}
                    organization={organization}
                    transactionName={transactionName}
                    project={projects.find(p => p.id === projectId)}
                    isLoading={isLoading}
                    suspectSpans={suspectSpans ?? []}
                    totals={totals}
                    sort={sort.field}
                  />
                  <Pagination pageLinks={pageLinks ?? null} />
                </Fragment>
              )}
            </SuspectSpansQuery>
          );
        }}
      </DiscoverQuery>
    </Layout.Main>
  );
}

function getSpansEventView(eventView: EventView, sort: SpanSort): EventView {
  eventView = eventView.clone();
  const fields = SPAN_SORT_TO_FIELDS[sort];
  eventView.fields = fields ? fields.map(field => ({field})) : [];
  return eventView;
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(3, min-content);
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: auto auto 1fr auto;
  }
`;

const StyledSearchBar = styled(SearchBar)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 1;
    grid-column: 1/5;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    order: initial;
    grid-column: auto;
  }
`;

export default SpansContent;
