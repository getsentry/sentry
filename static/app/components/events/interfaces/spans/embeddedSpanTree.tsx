import React, {useContext} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {Event, EventTransaction, Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import GenericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import TraceView from './traceView';
import WaterfallModel from './waterfallModel';

type Props = {
  affectedSpanIds: string[];
  event: Event;
  organization: Organization;
  projectSlug: string;
};

// This is a wrapper class that is intended to be used within Performance Issues
export function EmbeddedSpanTree(props: Props) {
  const {organization, projectSlug, affectedSpanIds} = props;
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
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
