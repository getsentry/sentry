import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading as _SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tn} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {formatPercentage} from 'sentry/utils/formatters';
import SpanExamplesQuery, {
  ChildrenProps as SpanExamplesProps,
} from 'sentry/utils/performance/suspectSpans/spanExamplesQuery';
import SuspectSpansQuery, {
  ChildrenProps as SuspectSpansProps,
} from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {SuspectSpan} from 'sentry/utils/performance/suspectSpans/types';
import Breadcrumb from 'sentry/views/performance/breadcrumb';

import {PerformanceDuration} from '../../../utils';
import Tab from '../../tabs';
import SpanTable from '../spanTable';
import {emptyValue, SpanLabelContainer} from '../styles';
import {SpanSlug} from '../types';
import {getTotalsView} from '../utils';

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  projectId: string;
  transactionName: string;
  spanSlug: SpanSlug;
};

export default function SpanDetailsContentWrapper(props: Props) {
  const {location, organization, eventView, projectId, transactionName, spanSlug} = props;
  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={organization}
            location={location}
            transaction={{
              project: projectId,
              name: transactionName,
            }}
            tab={Tab.Spans}
          />
          <Layout.Title>{transactionName}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <DiscoverQuery
            eventView={getTotalsView(eventView)}
            orgSlug={organization.slug}
            location={location}
            referrer="api.performance.transaction-spans"
            cursor="0:0:1"
            noPagination
          >
            {({tableData}) => {
              const totalCount: number = tableData?.data?.[0]?.count ?? null;

              return (
                <SuspectSpansQuery
                  location={location}
                  orgSlug={organization.slug}
                  eventView={eventView}
                  perSuspect={0}
                  spanOps={[spanSlug.op]}
                  spanGroups={[spanSlug.group]}
                  cursor="0:0:1"
                >
                  {suspectSpansResults => {
                    return (
                      <SpanExamplesQuery
                        location={location}
                        orgSlug={organization.slug}
                        eventView={eventView}
                        spanOp={spanSlug.op}
                        spanGroup={spanSlug.group}
                        limit={10}
                      >
                        {spanExamplesResults => (
                          <SpanDetailsContent
                            location={location}
                            organization={organization}
                            spanSlug={spanSlug}
                            transactionName={transactionName}
                            totalCount={totalCount}
                            suspectSpansResults={suspectSpansResults}
                            spanExamplesResults={spanExamplesResults}
                          />
                        )}
                      </SpanExamplesQuery>
                    );
                  }}
                </SuspectSpansQuery>
              );
            }}
          </DiscoverQuery>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

type ContentProps = {
  location: Location;
  organization: Organization;
  spanSlug: SpanSlug;
  transactionName: string;
  totalCount: number;
  suspectSpansResults: SuspectSpansProps;
  spanExamplesResults: SpanExamplesProps;
};

function SpanDetailsContent(props: ContentProps) {
  const {
    location,
    organization,
    spanSlug,
    transactionName,
    totalCount,
    suspectSpansResults,
    spanExamplesResults,
  } = props;

  if (suspectSpansResults.isLoading) {
    return <LoadingIndicator />;
  }

  if (!suspectSpansResults.suspectSpans?.length) {
    return (
      <EmptyStateWarning>
        <p>{t('No span data found')}</p>
      </EmptyStateWarning>
    );
  }

  // There should always be exactly 1 result
  const suspectSpan = suspectSpansResults.suspectSpans[0];
  const examples = spanExamplesResults.examples?.[0]?.examples;
  const description = examples?.[0]?.description ?? null;

  return (
    <Fragment>
      <SpanDetailsHeader
        spanSlug={spanSlug}
        description={description}
        suspectSpan={suspectSpan}
        totalCount={totalCount}
      />
      <SpanTable
        location={location}
        organization={organization}
        suspectSpan={suspectSpan}
        transactionName={transactionName}
        isLoading={spanExamplesResults.isLoading}
        examples={examples ?? []}
        pageLinks={spanExamplesResults.pageLinks}
      />
    </Fragment>
  );
}

type HeaderProps = {
  spanSlug: SpanSlug;
  description: string | null;
  suspectSpan: SuspectSpan;
  totalCount: number | null;
};

function SpanDetailsHeader(props: HeaderProps) {
  const {spanSlug, description, suspectSpan, totalCount} = props;

  const {
    frequency,
    p75ExclusiveTime,
    p95ExclusiveTime,
    p99ExclusiveTime,
    sumExclusiveTime,
  } = suspectSpan;

  return (
    <ContentHeader>
      <HeaderInfo data-test-id="header-operation-name">
        <SectionHeading>{t('Span Operation')}</SectionHeading>
        <SectionBody>
          <SpanLabelContainer>{description ?? emptyValue}</SpanLabelContainer>
        </SectionBody>
        <SectionSubtext data-test-id="operation-name">{spanSlug.op}</SectionSubtext>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-percentiles">
        <SectionHeading>{t('Exclusive Time Percentiles')}</SectionHeading>
        <PercentileHeaderBodyWrapper>
          <div data-test-id="section-p75">
            <SectionBody>
              {defined(p75ExclusiveTime) ? (
                <PerformanceDuration abbreviation milliseconds={p75ExclusiveTime} />
              ) : (
                '\u2014'
              )}
            </SectionBody>
            <SectionSubtext>{t('p75')}</SectionSubtext>
          </div>
          <div data-test-id="section-p95">
            <SectionBody>
              {defined(p95ExclusiveTime) ? (
                <PerformanceDuration abbreviation milliseconds={p95ExclusiveTime} />
              ) : (
                '\u2014'
              )}
            </SectionBody>
            <SectionSubtext>{t('p95')}</SectionSubtext>
          </div>
          <div data-test-id="section-p99">
            <SectionBody>
              {defined(p99ExclusiveTime) ? (
                <PerformanceDuration abbreviation milliseconds={p99ExclusiveTime} />
              ) : (
                '\u2014'
              )}
            </SectionBody>
            <SectionSubtext>{t('p99')}</SectionSubtext>
          </div>
        </PercentileHeaderBodyWrapper>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-frequency">
        <SectionHeading>{t('Frequency')}</SectionHeading>
        <SectionBody>
          {defined(frequency) && defined(totalCount)
            ? formatPercentage(Math.min(frequency, totalCount) / totalCount)
            : '\u2014'}
        </SectionBody>
        <SectionSubtext>{tn('%s event', '%s events', frequency)}</SectionSubtext>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-total-exclusive-time">
        <SectionHeading>{t('Total Exclusive Time')}</SectionHeading>
        <SectionBody>
          {defined(sumExclusiveTime) ? (
            <PerformanceDuration abbreviation milliseconds={sumExclusiveTime} />
          ) : (
            '\u2014'
          )}
        </SectionBody>
        <SectionSubtext>TBD</SectionSubtext>
      </HeaderInfo>
    </ContentHeader>
  );
}

const ContentHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  grid-gap: ${space(4)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: auto repeat(3, max-content);
    grid-row-gap: 0;
  }
`;

const HeaderInfo = styled('div')`
  ${overflowEllipsis};
  height: 78px;
`;

const SectionHeading = styled(_SectionHeading)`
  margin: 0;
`;

const SectionBody = styled('div')<{overflowEllipsis?: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: ${space(0.5)} 0;
  max-height: 32px;
`;

const SectionSubtext = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const PercentileHeaderBodyWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  grid-gap: ${space(3)};
`;
