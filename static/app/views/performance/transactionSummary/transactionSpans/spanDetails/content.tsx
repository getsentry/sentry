import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading as _SectionHeading} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import * as Layout from 'sentry/components/layouts/thirds';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
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
import {SpanSlug, SuspectSpan} from 'sentry/utils/performance/suspectSpans/types';
import Breadcrumb from 'sentry/views/performance/breadcrumb';

import Tab from '../../tabs';
import {SpanSortOthers} from '../types';
import {getTotalsView} from '../utils';

import SpanChart from './chart';
import SpanTable from './spanDetailsTable';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  project: Project | undefined;
  spanSlug: SpanSlug;
  transactionName: string;
};

export default function SpanDetailsContentWrapper(props: Props) {
  const {location, organization, eventView, project, transactionName, spanSlug} = props;

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={organization}
            location={location}
            transaction={{
              project: project?.id ?? '',
              name: transactionName,
            }}
            tab={Tab.Spans}
            spanSlug={spanSlug}
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
                  eventView={getSpansEventView(eventView)}
                  perSuspect={0}
                  spanOps={[spanSlug.op]}
                  spanGroups={[spanSlug.group]}
                  cursor="0:0:1"
                >
                  {suspectSpansResults => (
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
                          project={project}
                          eventView={eventView}
                          spanSlug={spanSlug}
                          transactionName={transactionName}
                          totalCount={totalCount}
                          suspectSpansResults={suspectSpansResults}
                          spanExamplesResults={spanExamplesResults}
                        />
                      )}
                    </SpanExamplesQuery>
                  )}
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
  eventView: EventView;
  location: Location;
  organization: Organization;
  project: Project | undefined;
  spanExamplesResults: SpanExamplesProps;
  spanSlug: SpanSlug;
  suspectSpansResults: SuspectSpansProps;
  totalCount: number;
  transactionName: string;
};

function SpanDetailsContent(props: ContentProps) {
  const {
    location,
    organization,
    project,
    eventView,
    spanSlug,
    transactionName,
    totalCount,
    suspectSpansResults,
    spanExamplesResults,
  } = props;

  // There should always be exactly 1 result
  const suspectSpan = suspectSpansResults.suspectSpans?.[0];
  const examples = spanExamplesResults.examples?.[0]?.examples;

  return (
    <Fragment>
      <SpanDetailsHeader
        spanSlug={spanSlug}
        totalCount={totalCount}
        suspectSpan={suspectSpan}
      />
      <SpanChart organization={organization} eventView={eventView} spanSlug={spanSlug} />
      <SpanTable
        location={location}
        organization={organization}
        project={project}
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
  totalCount: number | null;
  suspectSpan?: SuspectSpan;
};

function SpanDetailsHeader(props: HeaderProps) {
  const {spanSlug, suspectSpan, totalCount} = props;

  const {
    description,
    frequency,
    avgOccurrences,
    p75ExclusiveTime,
    p95ExclusiveTime,
    p99ExclusiveTime,
    sumExclusiveTime,
  } = suspectSpan ?? {};

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
        <SectionSubtext>
          {defined(avgOccurrences)
            ? tct('[times] times per event', {times: avgOccurrences.toFixed(2)})
            : '\u2014'}
        </SectionSubtext>
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
        <SectionSubtext>
          {defined(frequency)
            ? tct('[events] events', {events: <Count value={frequency} />})
            : '\u2014'}
        </SectionSubtext>
      </HeaderInfo>
    </ContentHeader>
  );
}

function getSpansEventView(eventView: EventView): EventView {
  // TODO: There is a bug where if the sort is not avg occurrence,
  // then the avg occurrence will never be added to the fields
  eventView = eventView.withSorts([{field: SpanSortOthers.AVG_OCCURRENCE, kind: 'desc'}]);
  eventView.fields = [
    {field: 'count()'},
    {field: 'count_unique(id)'},
    {field: 'equation|count() / count_unique(id)'},
    {field: 'sumArray(spans_exclusive_time)'},
    {field: 'percentileArray(spans_exclusive_time, 0.75)'},
    {field: 'percentileArray(spans_exclusive_time, 0.95)'},
    {field: 'percentileArray(spans_exclusive_time, 0.99)'},
  ];
  return eventView;
}

const ContentHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(4)};
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
  gap: ${space(3)};
`;

export const SpanLabelContainer = styled('div')`
  ${overflowEllipsis};
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

const emptyValue = <EmptyValueContainer>{t('(unnamed span)')}</EmptyValueContainer>;
