import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  ErrorDot,
  ErrorLevel,
  ErrorMessageContent,
  ErrorTitle,
} from 'sentry/components/performance/waterfall/rowDetails';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {TraceMeta} from 'sentry/utils/performance/quickTrace/types';

interface TraceNotFoundProps {
  location: any;
  meta: TraceMeta | null;
  organization: Organization;
  traceEventView: EventView;
  traceSlug: string;
}

function TraceNotFound({
  meta,
  traceEventView,
  traceSlug,
  organization,
  location,
}: TraceNotFoundProps) {
  const transactions = meta?.transactions ?? 0;
  const errors = meta?.errors ?? 0;

  if (transactions === 0 && errors > 0) {
    const errorsEventView = traceEventView.withColumns([
      {kind: 'field', field: 'project'},
      {kind: 'field', field: 'title'},
      {kind: 'field', field: 'issue.id'},
      {kind: 'field', field: 'level'},
    ]);
    errorsEventView.query = `trace:${traceSlug} !event.type:transaction `;

    return (
      <DiscoverQuery
        eventView={errorsEventView}
        orgSlug={organization.slug}
        location={location}
        referrer="api.trace-view.errors-view"
        useEvents
      >
        {({isLoading, tableData, error}) => {
          if (isLoading) {
            return <LoadingIndicator />;
          }

          if (error) {
            return (
              <Alert type="error" showIcon>
                <ErrorLabel>
                  {tct(
                    'The trace cannot be shown when all events are errors. An error occurred when attempting to fetch these error events: [error]',
                    {error: error.message}
                  )}
                </ErrorLabel>
              </Alert>
            );
          }

          return (
            <Alert type="error" showIcon>
              <ErrorLabel>
                {t('The trace cannot be shown when all events are errors.')}
              </ErrorLabel>

              <ErrorMessageContent data-test-id="trace-view-errors">
                {tableData?.data.map(data => (
                  <Fragment key={data.id}>
                    <ErrorDot level={data.level as any} />
                    <ErrorLevel>{data.level}</ErrorLevel>
                    <ErrorTitle>
                      <Link
                        to={`/organizations/${organization.slug}/issues/${data['issue.id']}/events/${data.id}?referrer=performance-trace-not-found`}
                      >
                        {data.title}
                      </Link>
                    </ErrorTitle>
                  </Fragment>
                ))}
              </ErrorMessageContent>
            </Alert>
          );
        }}
      </DiscoverQuery>
    );
  }

  return <LoadingError message={t('The trace you are looking for was not found.')} />;
}

const ErrorLabel = styled('div')`
  margin-bottom: ${space(1)};
`;

export default TraceNotFound;
