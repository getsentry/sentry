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
import EventView from 'app/utils/discover/eventView';
import SuspectSpansQuery from 'app/utils/performance/suspectSpans/suspectSpansQuery';
import {decodeScalar} from 'app/utils/queryString';

import {SetStateAction} from '../types';
import {generateTransactionLink} from '../utils';

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

  function handleChange(key: string) {
    return function (value: string) {
      const queryParams = getParams({
        ...(location.query || {}),
        [key]: value,
      });

      // do not propagate pagination when making a new search
      const searchQueryParams = omit(queryParams, 'cursor');

      browserHistory.push({
        ...location,
        query: searchQueryParams,
      });
    };
  }

  const sort = getSuspectSpanSortFromEventView(eventView);

  return (
    <Layout.Main fullWidth>
      <Actions>
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
