import React from 'react';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import * as Layout from 'app/components/layouts/thirds';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import TraceFullQuery from 'app/utils/performance/quickTrace/traceFullQuery';
import {decodeScalar} from 'app/utils/queryString';
import Breadcrumb from 'app/views/performance/breadcrumb';
import {MetaData} from 'app/views/performance/transactionDetails/styles';

import {getTraceInfo} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  params: Params;
  traceSlug: string;
};

type TraceQueryProps = Omit<React.ComponentProps<typeof TraceFullQuery>, 'children'>;

class TraceDetailsContent extends React.Component<Props> {
  getTraceQueryProps(): TraceQueryProps {
    const {location, organization, traceSlug} = this.props;
    const {query} = location;
    const start = decodeScalar(query.start);
    const end = decodeScalar(query.end);

    if (!start || !end) {
      throw new Error('No date range selection found.');
    }

    return {
      location,
      orgSlug: organization.slug,
      traceId: traceSlug,
      start,
      end,
    };
  }

  renderTraceContent(traceQueryProps: TraceQueryProps) {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <TraceFullQuery {...traceQueryProps}>
            {({isLoading, error, trace}) => {
              if (isLoading) {
                return <LoadingIndicator />;
              } else if (error !== null || trace === null) {
                return (
                  <LoadingError
                    message={t('The trace you are looking for was not found.')}
                  />
                );
              }

              const traceInfo = getTraceInfo(trace);

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
                      traceInfo.relevantProjects
                    )}
                  />
                </TraceDetailHeader>
              );
            }}
          </TraceFullQuery>
        </Layout.Main>
      </Layout.Body>
    );
  }

  renderNoContent() {
    return (
      <React.Fragment>
        There is no content for me to show here. Probably because there is no date
        selection, so sad.
      </React.Fragment>
    );
  }

  renderContent() {
    try {
      const traceQueryProps = this.getTraceQueryProps();
      return this.renderTraceContent(traceQueryProps);
    } catch (error) {
      return this.renderNoContent();
    }
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
        {this.renderContent()}
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

export default TraceDetailsContent;
