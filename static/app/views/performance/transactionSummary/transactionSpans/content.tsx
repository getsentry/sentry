import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import DatePageFilter from 'sentry/components/datePageFilter';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
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
import {Actions} from './styles';
import SuspectSpansTable from './suspectSpansTable';
import {SpanSort, SpansTotalValues} from './types';
import {
  getSuspectSpanSortFromEventView,
  getTotalsView,
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
      {organization.features.includes('selection-filters-v2') && (
        <StyledPageFilterBar condensed>
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="left" />
        </StyledPageFilterBar>
      )}
      <Actions>
        <OpsFilter
          location={location}
          eventView={eventView}
          organization={organization}
          handleOpChange={handleChange('spanOp')}
          transactionName={transactionName}
        />
        <SearchBar
          organization={organization}
          projectIds={eventView.project}
          query={query}
          fields={eventView.fields}
          onSearch={handleChange('query')}
        />
        <DropdownControl buttonProps={{prefix: sort.prefix}} label={sort.label}>
          {SPAN_SORT_OPTIONS.map(option => (
            <DropdownItem
              key={option.field}
              eventKey={option.field}
              isActive={option.field === sort.field}
              onSelect={handleChange('sort')}
            >
              {option.label}
            </DropdownItem>
          ))}
        </DropdownControl>
      </Actions>
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

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(1)};
`;

function getSpansEventView(eventView: EventView, sort: SpanSort): EventView {
  eventView = eventView.clone();
  const fields = SPAN_SORT_TO_FIELDS[sort];
  eventView.fields = fields ? fields.map(field => ({field})) : [];
  return eventView;
}

export default SpansContent;
