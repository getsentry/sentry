import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {CompactSelect} from 'sentry/components/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import {SpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import SuspectSpansQuery from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
import SpanMetricsTable from 'sentry/views/performance/transactionSummary/transactionSpans/spanMetricsTable';

import type {SetStateAction} from '../types';

import OpsFilter from './opsFilter';
import SuspectSpansTable from './suspectSpansTable';
import type {SpanSort, SpansTotalValues} from './types';
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
    trackAnalytics('performance_views.spans.change_op', {
      organization,
      operation_name: value,
    }),
  sort: (organization: Organization, value: string | undefined) =>
    trackAnalytics('performance_views.spans.change_sort', {
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
  const navigate = useNavigate();
  const query = decodeScalar(location.query.query, '');

  const handleChange = useCallback(
    (key: string) => {
      return function (value: string | undefined) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

        navigate({
          ...location,
          query: searchQueryParams,
        });
      };
    },
    [location, navigate, organization]
  );

  const spanOp = decodeScalar(location.query.spanOp);
  const spanGroup = decodeScalar(location.query.spanGroup);
  const sort = getSuspectSpanSortFromEventView(eventView);
  const spansView = getSpansEventView(eventView, sort.field);
  const totalsView = getTotalsView(eventView);

  const {projects} = useProjects();

  const onSearch = useMemo(() => handleChange('query'), [handleChange]);
  const projectIds = useMemo(() => eventView.project.slice(), [eventView]);

  const hasNewSpansUIFlag =
    organization.features.includes('performance-spans-new-ui') &&
    organization.features.includes('insights-initial-modules');

  // TODO: Remove this flag when the feature is GA'd and replace the old content entirely
  if (hasNewSpansUIFlag) {
    return <SpansContentV2 {...props} />;
  }

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
            maxPickableDays={SPAN_RETENTION_DAYS}
            relativeOptions={SPAN_RELATIVE_PERIODS}
          />
        </PageFilterBar>
        <StyledSearchBarWrapper>
          <SpanSearchQueryBuilder
            projects={projectIds}
            initialQuery={query}
            onSearch={onSearch}
            searchSource="transaction_spans"
          />
          <CompactSelect
            value={sort.field}
            options={SPAN_SORT_OPTIONS.map(opt => ({value: opt.field, label: opt.label}))}
            onChange={opt => handleChange('sort')(opt.value)}
            triggerProps={{prefix: sort.prefix}}
            triggerLabel={sort.label}
          />
        </StyledSearchBarWrapper>
      </FilterActions>
      <DiscoverQuery
        eventView={totalsView}
        orgSlug={organization.slug}
        location={location}
        referrer="api.performance.transaction-spans"
        cursor="0:0:1"
        noPagination
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
                  <VisuallyCompleteWithData
                    id="TransactionSpans-SuspectSpansTable"
                    hasData={!!suspectSpans?.length}
                    isLoading={isLoading}
                  >
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
                  </VisuallyCompleteWithData>
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

// TODO: Temporary component while we make the switch to spans only. Will fully replace the old Spans tab when GA'd
function SpansContentV2(props: Props) {
  const {location, organization, eventView, projectId, transactionName} = props;
  const navigate = useNavigate();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === projectId);
  const spansQuery = decodeScalar(location.query.spansQuery, '');

  const handleChange = useCallback(
    (key: string) => {
      return function (value: string | undefined) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

        navigate({
          ...location,
          query: searchQueryParams,
        });
      };
    },
    [location, navigate, organization]
  );

  const onSearch = useMemo(() => handleChange('spansQuery'), [handleChange]);
  const projectIds = useMemo(() => eventView.project.slice(), [eventView]);

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
          <DatePageFilter />
        </PageFilterBar>
        <SpanSearchQueryBuilder
          projects={projectIds}
          initialQuery={spansQuery}
          onSearch={onSearch}
          searchSource="transaction_spans"
        />
      </FilterActions>

      <SpanMetricsTable
        project={project}
        transactionName={transactionName}
        query={spansQuery ?? ''}
      />
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

const StyledSearchBarWrapper = styled('div')`
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
