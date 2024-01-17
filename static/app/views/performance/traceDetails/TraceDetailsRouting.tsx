import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import {LocationDescriptorObject} from 'history';

import {transactionTargetHash} from 'sentry/components/events/interfaces/spans/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Event} from 'sentry/types';
import {TraceMetaQueryChildrenProps} from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {DEFAULT_TRACE_ROWS_LIMIT} from './limitExceededMessage';
import {getTraceDetailsUrl} from './utils';

type Props = {
  children: JSX.Element;
  event: Event;
  metaResults: TraceMetaQueryChildrenProps | undefined;
};

function TraceDetailsRouting(props: Props) {
  const {metaResults, event, children} = props;
  const organization = useOrganization();
  const location = useLocation();
  const datetimeSelection = normalizeDateTimeParams(location.query);

  useEffect(() => {
    const traceId = event.contexts?.trace?.trace_id ?? '';

    if (
      organization.features.includes('performance-trace-details') &&
      metaResults?.meta &&
      metaResults?.meta.transactions <= DEFAULT_TRACE_ROWS_LIMIT
    ) {
      const traceDetailsLocation: LocationDescriptorObject = getTraceDetailsUrl(
        organization,
        traceId,
        datetimeSelection,
        location.query
      );

      browserHistory.replace({
        pathname: traceDetailsLocation.pathname,
        query: traceDetailsLocation.query,
        hash: transactionTargetHash(event.eventID) + location.hash,
      });
    }
  }, [event, metaResults, location, organization, datetimeSelection]);

  if (
    metaResults?.isLoading &&
    organization.features.includes('performance-trace-details')
  ) {
    return <LoadingIndicator />;
  }

  return children;
}

export default TraceDetailsRouting;
