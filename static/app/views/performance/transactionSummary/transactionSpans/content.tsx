import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import omit from 'lodash/omit';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import SearchBar from 'app/components/events/searchBar';
import * as Layout from 'app/components/layouts/thirds';
import LoadingIndicator from 'app/components/loadingIndicator';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Pagination from 'app/components/pagination';
import {Organization} from 'app/types';
import {defined} from 'app/utils';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {isAggregateField} from 'app/utils/discover/fields';
import SuspectSpansQuery from 'app/utils/performance/suspectSpans/suspectSpansQuery';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';

import {SetStateAction} from '../types';
import {generateTransactionLink} from '../utils';

import OpsFilter from './opsFilter';
import {Actions} from './styles';
import SuspectSpanCard from './suspectSpanCard';
import {SpansTotalValues} from './types';
import {getSuspectSpanSortFromEventView, SPAN_SORT_OPTIONS} from './utils';

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
              spanOps={defined(spanOp) ? [spanOp] : []}
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
                  // TODO: empty state
                  return null;
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

/**
 * For the totals view, we want to get some transaction level stats like
 * the number of transactions and the sum of the transaction duration.
 * This requires the removal of any aggregate conditions as they can result
 * in unexpected empty responses.
 */
function getTotalsView(eventView: EventView): EventView {
  const totalsView = eventView.withColumns([
    {kind: 'function', function: ['count', '', undefined, undefined]},
    {kind: 'function', function: ['sum', 'transaction.duration', undefined, undefined]},
  ]);

  const conditions = new MutableSearch(eventView.query);

  // filter out any aggregate conditions
  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  totalsView.query = conditions.formatString();
  return totalsView;
}

export default SpansContent;
