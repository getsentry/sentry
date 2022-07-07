import React, {useCallback, useEffect, useState} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Event, EventTransaction, Organization} from 'sentry/types';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import useApi from 'sentry/utils/useApi';

import TraceView from './traceView';
import {FocusedSpanIDMap} from './types';
import WaterfallModel from './waterfallModel';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
  transactionID: string;
  waterfallModel: WaterfallModel;
  focusedSpanIds?: FocusedSpanIDMap;
};

// This is a wrapper class that is intended to be used within Performance Issues
export function EmbeddedSpanTree(props: Props) {
  const {organization, transactionID, projectSlug, focusedSpanIds} = props;
  const api = useApi();

  const [eventTransaction, setEventTransaction] = useState<EventTransaction>();
  const [status, setStatus] = useState('loading');

  const fetchEventTransaction = useCallback(() => {
    const eventSlug = generateEventSlug({
      id: transactionID,
      project: projectSlug,
    });

    api.clear();
    api.request(`/organizations/${organization.slug}/events/${eventSlug}/`, {
      success: eventData => {
        setStatus('success');
        setEventTransaction(eventData);
      },
      error: () => {
        setStatus('error');
      },
    });
  }, [api, organization, projectSlug, transactionID]);

  useEffect(() => {
    fetchEventTransaction();
  }, [fetchEventTransaction]);

  return (
    <React.Fragment>
      {eventTransaction ? (
        <TraceView
          organization={organization}
          waterfallModel={new WaterfallModel(eventTransaction!, focusedSpanIds)}
        />
      ) : status === 'loading' ? (
        <LoadingIndicator />
      ) : (
        // TODO: Put a proper error component here instead
        <p>Error: {status}</p>
      )}
    </React.Fragment>
  );
}
