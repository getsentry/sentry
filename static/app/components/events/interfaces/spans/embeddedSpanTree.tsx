import React, {useContext} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QuickTrace from 'sentry/components/quickTrace';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, EventTransaction, Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import GenericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import TraceView from './traceView';
import WaterfallModel from './waterfallModel';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
  affectedSpanIds?: string[];
};

// This is a wrapper class that is intended to be used within Performance Issues
export function EmbeddedSpanTree(props: Props) {
  const {event, organization, projectSlug, affectedSpanIds} = props;
  const api = useApi();
  const location = useLocation();
  const quickTrace = useContext(QuickTraceContext);

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

  function getContent() {
    if (!quickTrace) {
      return null;
    }

    if (quickTrace.isLoading) {
      return <LoadingIndicator />;
    }

    if (!quickTrace.currentEvent) {
      return (
        <LoadingError
          message={t(
            'Error loading the span tree because the root transaction is missing'
          )}
        />
      );
    }

    return (
      <GenericDiscoverQuery
        eventView={eventView}
        orgSlug={organization.slug}
        route={`events/${projectSlug}:${quickTrace.currentEvent.event_id}`}
        api={api}
        location={location}
      >
        {results => {
          if (results.isLoading) {
            return <LoadingIndicator />;
          }

          if (!results.tableData) {
            return (
              <LoadingError
                message={t(
                  'Error loading the span tree because the root transaction is missing'
                )}
              />
            );
          }

          return (
            <Wrapper>
              <Header>
                <h3>{t('Span Tree')}</h3>
                <QuickTrace
                  event={event}
                  quickTrace={quickTrace!}
                  location={location}
                  organization={organization}
                  anchor="left"
                  errorDest="issue"
                  transactionDest="performance"
                />
              </Header>

              <Section>
                <TraceView
                  organization={organization}
                  waterfallModel={
                    new WaterfallModel(
                      results.tableData as EventTransaction,
                      affectedSpanIds
                    )
                  }
                  isEmbedded
                />
              </Section>
            </Wrapper>
          );
        }}
      </GenericDiscoverQuery>
    );
  }

  return (
    <React.Fragment>
      <ErrorBoundary mini>{getContent()}</ErrorBoundary>
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

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const Section = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
