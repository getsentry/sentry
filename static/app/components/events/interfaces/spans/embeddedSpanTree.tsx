import React from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import space from 'sentry/styles/space';
import {Event, EventTransaction, Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import GenericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import TraceView from './traceView';
import {FocusedSpanIDMap} from './types';
import WaterfallModel from './waterfallModel';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
  focusedSpanIds?: FocusedSpanIDMap;
};

// This is a wrapper class that is intended to be used within Performance Issues
export function EmbeddedSpanTree(props: Props) {
  const {event, organization, projectSlug, focusedSpanIds} = props;
  const api = useApi();
  const location = useLocation();

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: '',
      fields: ['transaction.duration'],
      projects: [1],
      query: 'event.type:transaction',
      environment: [],
    },
    location
  );

  return (
    <React.Fragment>
      <ErrorBoundary mini>
        <QuickTraceQuery event={event} location={location} orgSlug={organization.slug}>
          {results => {
            if (results.isLoading) {
              return <LoadingIndicator />;
            }

            if (!results.currentEvent) {
              return <LoadingError />;
            }

            return (
              <GenericDiscoverQuery
                eventView={eventView}
                orgSlug={organization.slug}
                route={`events/${projectSlug}:${results.currentEvent?.event_id}`}
                api={api}
                location={location}
              >
                {_results => {
                  if (_results.isLoading) {
                    return <LoadingIndicator />;
                  }

                  if (!_results.tableData) {
                    return <LoadingError />;
                  }

                  return (
                    <Wrapper>
                      <h3>Span Tree</h3>
                      <Section>
                        <TraceView
                          organization={organization}
                          waterfallModel={
                            new WaterfallModel(
                              _results.tableData as EventTransaction,
                              focusedSpanIds
                            )
                          }
                        />
                      </Section>
                    </Wrapper>
                  );
                }}
              </GenericDiscoverQuery>
            );
          }}
        </QuickTraceQuery>
      </ErrorBoundary>
    </React.Fragment>
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
    margin-bottom: ${space(2)};
    text-transform: uppercase;
  }
`;

const Section = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
