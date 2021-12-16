import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading as _SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {formatPercentage} from 'sentry/utils/formatters';
import SuspectSpansQuery from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {SuspectSpan} from 'sentry/utils/performance/suspectSpans/types';
import Breadcrumb from 'sentry/views/performance/breadcrumb';

import {PerformanceDuration} from '../../../utils';
import Tab from '../../tabs';
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

export default function SpanDetailsContent(props: Props) {
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
                >
                  {({suspectSpans, isLoading}) => {
                    if (isLoading) {
                      return <LoadingIndicator />;
                    }

                    if (!suspectSpans?.length) {
                      return (
                        <EmptyStateWarning>
                          <p>{t('No span data found')}</p>
                        </EmptyStateWarning>
                      );
                    }

                    // There should always be exactly 1 result
                    const suspectSpan = suspectSpans[0];

                    return (
                      <Fragment>
                        <SpanDetailsHeader
                          spanSlug={spanSlug}
                          suspectSpan={suspectSpan}
                          totalCount={totalCount}
                        />
                      </Fragment>
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

type HeaderProps = {
  spanSlug: SpanSlug;
  suspectSpan: SuspectSpan;
  totalCount: number | null;
};

function SpanDetailsHeader(props: HeaderProps) {
  const {spanSlug, suspectSpan, totalCount} = props;

  const frequency = totalCount
    ? Math.min(suspectSpan.frequency, totalCount)
    : suspectSpan.frequency;

  return (
    <ContentHeader>
      <HeaderInfo data-test-id="header-operation-name">
        <SectionHeading>{t('Span Operation')}</SectionHeading>
        <SectionBody>Span Description Placeholder</SectionBody>
        <SectionSubtext data-test-id="operation-name">{spanSlug.op}</SectionSubtext>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-percentiles">
        <SectionHeading>{t('Exclusive Time Percentiles')}</SectionHeading>
        <PercentileHeaderBodyWrapper>
          <div data-test-id="section-p75">
            <SectionBody>
              <PerformanceDuration
                abbreviation
                milliseconds={suspectSpan.p75ExclusiveTime}
              />
            </SectionBody>
            <SectionSubtext>{t('p75')}</SectionSubtext>
          </div>
          <div data-test-id="section-p95">
            <SectionBody>
              <PerformanceDuration
                abbreviation
                milliseconds={suspectSpan.p95ExclusiveTime}
              />
            </SectionBody>
            <SectionSubtext>{t('p95')}</SectionSubtext>
          </div>
          <div data-test-id="section-p99">
            <SectionBody>
              <PerformanceDuration
                abbreviation
                milliseconds={suspectSpan.p99ExclusiveTime}
              />
            </SectionBody>
            <SectionSubtext>{t('p99')}</SectionSubtext>
          </div>
        </PercentileHeaderBodyWrapper>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-frequency">
        <SectionHeading>{t('Frequency')}</SectionHeading>
        <SectionBody>
          {totalCount ? formatPercentage(frequency / totalCount) : '\u2014'}
        </SectionBody>
        <SectionSubtext>{tn('%s event', '%s events', frequency)}</SectionSubtext>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-total-exclusive-time">
        <SectionHeading>{t('Total Exclusive Time')}</SectionHeading>
        <SectionBody>
          <PerformanceDuration abbreviation milliseconds={suspectSpan.sumExclusiveTime} />
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
    grid-template-columns: auto max-content max-content max-content;
    grid-row-gap: 0;
  }
`;

const HeaderInfo = styled('div')`
  height: 78px;
`;

const SectionHeading = styled(_SectionHeading)`
  margin: 0;
`;

const SectionBody = styled('div')`
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
  grid-template-columns: max-content max-content max-content;
  grid-gap: ${space(3)};
`;
