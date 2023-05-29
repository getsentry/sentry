import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {SpanBaselineTable} from 'sentry/views/starfish/views/spans/spanSummaryPage/spanBaselineTable';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spans/spanSummaryPanel';
import {ReleasePreview} from 'sentry/views/starfish/views/spans/spanSummaryPanel/releasePreview';
import {SpanTransactionsTable} from 'sentry/views/starfish/views/spans/spanSummaryPanel/spanTransactionsTable';
import {useSpanById} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanById';
import {useSpanMetrics} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanMetrics';
import {
  useSpanFirstSeenEvent,
  useSpanLastSeenEvent,
} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanSeenEvent';

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {}>;

function SpanSummaryPage({params}: Props) {
  const {groupId} = params;

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

export default SpanSummaryPage;
