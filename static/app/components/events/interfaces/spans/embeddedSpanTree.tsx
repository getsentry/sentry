import React, {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import space from 'sentry/styles/space';
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
    <Wrapper>
      <h3>Span Tree</h3>
      {eventTransaction ? (
        <Section>
          <TraceView
          organization={organization}
          waterfallModel={new WaterfallModel(eventTransaction!, focusedSpanIds)}
        />
        </Section>
      ) : status === 'loading' ? (
        <LoadingIndicator />
      ) : (
        // TODO: Put a proper error component here instead
        <p>Error: {status}</p>
      )}
    </Wrapper>
  );
}

export const Wrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  margin: 0;

  /* Padding aligns with Layout.Body */
  padding: ${space(3)} ${space(2)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(3)} ${space(4)} ${space(3)};
  }

  & h3,
  & h3 a {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    color: ${p => p.theme.gray300};
  }

  & h3 {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    padding: ${space(0.75)} 0;
    margin-bottom: 0;
    text-transform: uppercase;
  }
`;

const Section = styled('div')`
border: 1px solid ${p => p.theme.innerBorder};
`;
