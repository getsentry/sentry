import React from 'react';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import * as Layout from 'app/components/layouts/thirds';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import TraceFullQuery from 'app/utils/performance/quickTrace/traceFullQuery';
import {TraceFull} from 'app/utils/performance/quickTrace/types';
import {decodeScalar} from 'app/utils/queryString';
import Breadcrumb from 'app/views/performance/breadcrumb';
import {MetaData} from 'app/views/performance/transactionDetails/styles';

import TraceView from './traceView';
import {TraceInfo} from './types';
import {getTraceInfo} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  params: Params;
  traceSlug: string;
};

class TraceDetailsContent extends React.Component<Props> {
  renderTraceLoading() {
    return <LoadingIndicator />;
  }

  renderTraceRequiresDateRangeSelection() {
    return <LoadingError message={t('Trace view requires a date range selection.')} />;
  }

  renderTraceNotFound() {
    return <LoadingError message={t('The trace you are looking for was not found.')} />;
  }

  renderTraceHeader(traceInfo: TraceInfo) {
    return (
      <TraceDetailHeader>
        <MetaData
          headingText={t('Transactions')}
          tooltipText={t('All the transactions that are a part of this trace.')}
          bodyText={t(
            '%s of %s',
            traceInfo.relevantTransactions,
            traceInfo.totalTransactions
          )}
          subtext={tn(
            'Across %s project',
            'Across %s projects',
            traceInfo.relevantProjectsWithTransactions
          )}
        />
        <MetaData
          headingText={t('Errors')}
          tooltipText={t('All the errors that are a part of this trace.')}
          bodyText={t('%s of %s', traceInfo.relevantErrors, traceInfo.totalErrors)}
          subtext={tn(
            'Across %s project',
            'Across %s projects',
            traceInfo.relevantProjectsWithErrors
          )}
        />
      </TraceDetailHeader>
    );
  }

  renderTraceView(trace: TraceFull, traceInfo: TraceInfo) {
    return (
      <TraceDetailBody>
        <TraceView trace={trace} traceInfo={traceInfo} />
      </TraceDetailBody>
    );
  }

  renderContent() {
    const {location, organization, traceSlug} = this.props;
    const {query} = location;
    const start = decodeScalar(query.start);
    const end = decodeScalar(query.end);

    if (!start || !end) {
      Sentry.setTag('current.trace_id', traceSlug);
      Sentry.captureException(new Error('No date range selection found.'));
      return this.renderTraceRequiresDateRangeSelection();
    }

    return (
      <TraceFullQuery
        location={location}
        orgSlug={organization.slug}
        traceId={traceSlug}
        start={start}
        end={end}
      >
        {({isLoading, error, trace}) => {
          if (isLoading) {
            return this.renderTraceLoading();
          } else if (error !== null || trace === null) {
            return this.renderTraceNotFound();
          } else {
            const traceInfo = getTraceInfo(trace);

            return (
              <React.Fragment>
                {this.renderTraceHeader(traceInfo)}
                {this.renderTraceView(trace, traceInfo)}
              </React.Fragment>
            );
          }
        }}
      </TraceFullQuery>
    );
  }

  render() {
    const {organization, location, traceSlug} = this.props;

    return (
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              organization={organization}
              location={location}
              traceSlug={traceSlug}
            />
            <Layout.Title data-test-id="trace-header">
              {t('Trace Id: %s', traceSlug)}
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>{this.renderContent()}</Layout.Main>
        </Layout.Body>
      </React.Fragment>
    );
  }
}

const TraceDetailHeader = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, auto);
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) 6fr;
    grid-row-gap: 0;
    margin-bottom: 0;
  }
`;

const TraceDetailBody = styled('div')`
  margin-top: ${space(3)};
`;

export default TraceDetailsContent;
