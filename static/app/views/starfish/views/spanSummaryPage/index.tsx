import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/formatters';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useIndexedSpan} from 'sentry/views/starfish/queries/useIndexedSpan';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import SampleList from 'sentry/views/starfish/views/spanSummaryPage/sampleList';
import {SpanBaselineTable} from 'sentry/views/starfish/views/spanSummaryPage/spanBaselineTable';
import {SpanTransactionsTable} from 'sentry/views/starfish/views/spanSummaryPage/spanTransactionsTable';

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {transaction: string}>;

function SpanSummaryPage({params, location}: Props) {
  const {groupId} = params;
  const {transaction} = location.query;

  const {data: span} = useIndexedSpan(groupId, 'span-summary-page');
  const {data: spanMetrics} = useSpanMetrics({group: groupId});

  return (
    <Layout.Page>
      <PageFiltersContainer>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title> Span Summary </Layout.Title>
            </Layout.HeaderContent>{' '}
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              <PageErrorAlert />
              <FilterOptionsContainer>
                <DatePageFilter alignDropdown="left" />
              </FilterOptionsContainer>
              <BlockContainer>
                <Block title={t('Operation')}>{span?.op}</Block>
                <Block
                  title={t('Throughput')}
                  description={t('Throughput of this span per second')}
                >
                  <ThroughputCell throughputPerSecond={spanMetrics?.['spm()'] / 60} />
                </Block>
                <Block title={t('Duration')} description={t('Time spent in this span')}>
                  <DurationCell milliseconds={spanMetrics?.['p95(span.duration)']} />
                </Block>
                <Block
                  title={t('Time Spent')}
                  description={t(
                    'Time spent in this span as a proportion of total application time'
                  )}
                >
                  <TimeSpentCell
                    formattedTimeSpent={formatPercentage(
                      spanMetrics?.['time_spent_percentage()']
                    )}
                    totalSpanTime={spanMetrics?.['sum(span.duration)']}
                  />
                </Block>
              </BlockContainer>

              {span && <SpanBaselineTable span={span} />}
              {span && <SpanTransactionsTable span={span} />}

              {transaction && span?.group && (
                <SampleList groupId={span.group} transactionName={transaction} />
              )}
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </PageFiltersContainer>
    </Layout.Page>
  );
}

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
  margin-bottom: ${space(2)};
`;

type BlockProps = {
  children: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
};

export function Block({title, description, children}: BlockProps) {
  return (
    <BlockWrapper>
      <BlockTitle>
        {title}
        {description && (
          <BlockTooltipContainer>
            <QuestionTooltip size="sm" position="right" title={description} />
          </BlockTooltipContainer>
        )}
      </BlockTitle>
      <BlockContent>{children}</BlockContent>
    </BlockWrapper>
  );
}

const BlockTitle = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  margin-bottom: ${space(1)};
`;

const BlockContent = styled('h4')`
  margin: 0;
  font-weight: normal;
`;

const BlockTooltipContainer = styled('span')`
  margin-left: ${space(1)};
`;

export const BlockContainer = styled('div')`
  display: flex;
  & > div:last-child {
    padding-right: ${space(1)};
  }
  padding-bottom: ${space(2)};
`;

const BlockWrapper = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;

export default SpanSummaryPage;
