import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import omit from 'lodash/omit';

import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import SuspectSpansQuery from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {decodeScalar} from 'sentry/utils/queryString';

import {SetStateAction} from '../types';
import {generateTransactionLink} from '../utils';

import OpsFilter from './opsFilter';
import {Actions} from './styles';
import SuspectSpanCard from './suspectSpanCard';
import {SpansTotalValues} from './types';
import {getSuspectSpanSortFromEventView, getTotalsView, SPAN_SORT_OPTIONS} from './utils';

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
  location: Location;
  organization: Organization;
  eventView: EventView;
  setError: SetStateAction<string | undefined>;
  transactionName: string;
};

function SpansContent(props: Props) {
  const {location, organization, eventView, setError, transactionName} = props;
  const query = decodeScalar(location.query.query, '');

  function handleChange(key: string) {
    return function (value: string | undefined) {
      ANALYTICS_VALUES[key]?.(organization, value);

      const queryParams = getParams({
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
  const totalsView = getTotalsView(eventView);

  return (
    <Layout.Main fullWidth>
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
          const totals: SpansTotalValues | null = tableData?.data?.[0] ?? null;

          return (
            <SuspectSpansQuery
              location={location}
              orgSlug={organization.slug}
              eventView={eventView}
              perSuspect={10}
              spanOps={defined(spanOp) ? [spanOp] : []}
              spanGroups={defined(spanGroup) ? [spanGroup] : []}
            >
              {({suspectSpans, isLoading, error, pageLinks}) => {
                if (error) {
                  setError(error);
                  return null;
                }

                // make sure to clear the clear the error message
                setError(undefined);

                if (isLoading) {
                  return <LoadingIndicator />;
                }

                if (!suspectSpans?.length) {
                  return (
                    <EmptyStateWarning>
                      <p>{t('No span data found')}</p>
                    </EmptyStateWarning>
                  );
                }

                return (
                  <Fragment>
                    {suspectSpans.map(suspectSpan => (
                      <SuspectSpanCard
                        key={`${suspectSpan.op}-${suspectSpan.group}`}
                        location={location}
                        organization={organization}
                        suspectSpan={suspectSpan}
                        generateTransactionLink={generateTransactionLink(transactionName)}
                        eventView={eventView}
                        totals={totals}
                        preview={2}
                      />
                    ))}
                    <Pagination pageLinks={pageLinks} />
                  </Fragment>
                );
              }}
            </SuspectSpansQuery>
          );
        }}
      </DiscoverQuery>
    </Layout.Main>
  );
}

export default SpansContent;
