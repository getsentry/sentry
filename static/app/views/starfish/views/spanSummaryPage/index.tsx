import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {ReleasePreview} from 'sentry/views/starfish/components/releasePreview';
import {useSpanById} from 'sentry/views/starfish/queries/useSpanById';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {
  useSpanFirstSeenEvent,
  useSpanLastSeenEvent,
} from 'sentry/views/starfish/queries/useSpanSeenEvent';
import SampleList from 'sentry/views/starfish/views/spanSummaryPage/sampleList';
import {SpanBaselineTable} from 'sentry/views/starfish/views/spanSummaryPage/spanBaselineTable';
import {SpanTransactionsTable} from 'sentry/views/starfish/views/spanSummaryPage/spanTransactionsTable';

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {transaction: string}>;

function SpanSummaryPage({params, location}: Props) {
  const {groupId} = params;
  const {transaction} = location.query;

  const {data: span} = useSpanById(groupId, 'span-summary-page');
  const {data: spanMetrics} = useSpanMetrics({group_id: groupId});
  const {data: firstSeenSpanEvent} = useSpanFirstSeenEvent({group_id: groupId});
  const {data: lastSeenSpanEvent} = useSpanLastSeenEvent({group_id: groupId});

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
                <Block title={t('Operation')}>{span?.span_operation}</Block>
                <Block
                  title={t('First Seen')}
                  description={t(
                    'The first time this span was ever seen in the current retention window'
                  )}
                >
                  <TimeSince date={spanMetrics?.first_seen} />
                  {firstSeenSpanEvent?.release && (
                    <ReleasePreview release={firstSeenSpanEvent?.release} />
                  )}
                </Block>

                <Block
                  title={t('Last Seen')}
                  description={t('The most recent time this span was seen')}
                >
                  <TimeSince date={spanMetrics?.last_seen} />
                  {lastSeenSpanEvent?.release && (
                    <ReleasePreview release={lastSeenSpanEvent?.release} />
                  )}
                </Block>
              </BlockContainer>

              {span && <SpanBaselineTable span={span} />}
              {span && <SpanTransactionsTable span={span} />}

              {transaction && span?.group_id && (
                <SampleList groupId={span.group_id} transactionName={transaction} />
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
