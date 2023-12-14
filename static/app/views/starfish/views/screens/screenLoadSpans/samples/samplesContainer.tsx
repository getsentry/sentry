import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {CountCell} from 'sentry/views/starfish/components/tableCells/countCell';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanMetricsField, SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {Block} from 'sentry/views/starfish/views/spanSummaryPage/block';
import DurationChart from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart';
import SampleTable from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleTable/sampleTable';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsField;

type Props = {
  groupId: string;
  transactionName: string;
  release?: string;
  sectionSubtitle?: string;
  sectionTitle?: string;
  transactionMethod?: string;
};

export function ScreenLoadSampleContainer({
  groupId,
  transactionName,
  transactionMethod,
  release,
}: Props) {
  const router = useRouter();
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );

  const organization = useOrganization();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceSetHighlightedSpanId = useCallback(
    debounce(id => {
      setHighlightedSpanId(id);
    }, 10),
    []
  );

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    transaction: transactionName,
  };

  if (transactionMethod) {
    filters['transaction.method'] = transactionMethod;
  }

  if (release) {
    filters.release = release;
  }

  const {data} = useSpanMetrics(
    filters,
    [`avg(${SPAN_SELF_TIME})`, 'count()', SPAN_OP],
    undefined,
    undefined,
    undefined,
    'api.starfish.span-summary-panel-samples-table-avg'
  );

  const spanMetrics = data[0] ?? {};

  return (
    <Fragment>
      <PaddedTitle>
        {release && (
          <SectionTitle>
            <Tooltip title={release}>
              <Link
                to={{
                  pathname: normalizeUrl(
                    `/organizations/${organization?.slug}/releases/${encodeURIComponent(
                      release
                    )}/`
                  ),
                }}
              >
                {formatVersionAndCenterTruncate(release)}
              </Link>
            </Tooltip>
          </SectionTitle>
        )}
      </PaddedTitle>
      <Container>
        <Block title={DataTitles.avg} alignment="left">
          <DurationCell
            containerProps={{
              style: {
                textAlign: 'left',
              },
            }}
            milliseconds={spanMetrics?.[`avg(${SPAN_SELF_TIME})`]}
          />
        </Block>
        <Block title={DataTitles.count} alignment="left">
          <CountCell
            containerProps={{
              style: {
                textAlign: 'left',
              },
            }}
            count={spanMetrics?.['count()'] ?? 0}
          />
        </Block>
      </Container>
      <DurationChart
        groupId={groupId}
        transactionName={transactionName}
        transactionMethod={transactionMethod}
        onClickSample={span => {
          router.push(
            `/performance/${span.project}:${span['transaction.id']}/#span-${span.span_id}`
          );
        }}
        onMouseOverSample={sample => debounceSetHighlightedSpanId(sample.span_id)}
        onMouseLeaveSample={() => debounceSetHighlightedSpanId(undefined)}
        highlightedSpanId={highlightedSpanId}
        release={release}
      />
      <SampleTable
        highlightedSpanId={highlightedSpanId}
        transactionMethod={transactionMethod}
        onMouseLeaveSample={() => setHighlightedSpanId(undefined)}
        onMouseOverSample={sample => setHighlightedSpanId(sample.span_id)}
        groupId={groupId}
        transactionName={transactionName}
        release={release}
        columnOrder={[
          {
            key: 'transaction_id',
            name: t('Event ID'),
            width: COL_WIDTH_UNDEFINED,
          },
          {
            key: 'profile_id',
            name: t('Profile'),
            width: COL_WIDTH_UNDEFINED,
          },
          {
            key: 'avg_comparison',
            name: t('Compared to Average'),
            width: COL_WIDTH_UNDEFINED,
          },
        ]}
      />
    </Fragment>
  );
}

const SectionTitle = styled('div')`
  ${p => p.theme.text.cardTitle}
`;

const PaddedTitle = styled('div')`
  margin-bottom: ${space(1)};
`;

const Container = styled('div')`
  display: flex;
`;
