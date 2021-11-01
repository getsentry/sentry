import {Fragment, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import omit from 'lodash/omit';

import {fetchTotalCount} from 'app/actionCreators/events';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import SearchBar from 'app/components/events/searchBar';
import * as Layout from 'app/components/layouts/thirds';
import LoadingIndicator from 'app/components/loadingIndicator';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Pagination from 'app/components/pagination';
import {Organization} from 'app/types';
import {defined} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import SuspectSpansQuery from 'app/utils/performance/suspectSpans/suspectSpansQuery';
import {decodeScalar} from 'app/utils/queryString';
import useApi from 'app/utils/useApi';

import {SetStateAction} from '../types';
import {generateTransactionLink} from '../utils';

import OpsFilter from './opsFilter';
import {Actions} from './styles';
import SuspectSpanCard from './suspectSpanCard';
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

  const api = useApi();

  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    const payload = eventView.getEventsAPIPayload(location);
    fetchTotalCount(api, organization.slug, payload)
      .then(setTotalCount)
      .catch(Sentry.captureException);
  }, [api, organization.slug, eventView, location]);

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
                  totalCount={totalCount}
                />
              ))}
              <Pagination pageLinks={pageLinks} />
            </Fragment>
          );
        }}
      </SuspectSpansQuery>
    </Layout.Main>
  );
}

export default SpansContent;
