import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import type {SamplesTableColumnHeader} from 'sentry/views/insights/common/components/samplesTable/spanSamplesTable';
import {SpanSamplesTable} from 'sentry/views/insights/common/components/samplesTable/spanSamplesTable';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import type {SpanSample} from 'sentry/views/insights/common/queries/useSpanSamples';
import {useSpanSamples} from 'sentry/views/insights/common/queries/useSpanSamples';
import {useTransactions} from 'sentry/views/insights/common/queries/useTransactions';
import type {
  ModuleName,
  SpanMetricsQueryFilters,
  SubregionCode,
} from 'sentry/views/insights/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsField;

const SpanSamplesTableContainer = styled('div')``;

type Props = {
  groupId: string;
  moduleName: ModuleName;
  transactionName: string;
  additionalFields?: string[];
  additionalFilters?: Record<string, string>;
  columnOrder?: SamplesTableColumnHeader[];
  highlightedSpanId?: string;
  onMouseLeaveSample?: () => void;
  onMouseOverSample?: (sample: SpanSample) => void;
  referrer?: string;
  release?: string;
  spanSearch?: MutableSearch;
  subregions?: SubregionCode[];
  transactionMethod?: string;
};

function SampleTable({
  groupId,
  moduleName,
  transactionName,
  highlightedSpanId,
  onMouseLeaveSample,
  onMouseOverSample,
  transactionMethod,
  columnOrder,
  release,
  spanSearch,
  additionalFields,
  additionalFilters,
  subregions,
  referrer,
}: Props) {
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

  if (subregions) {
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    filters[SpanMetricsField.USER_GEO_SUBREGION] = `[${subregions.join(',')}]`;
  }

  const {data, isFetching: isFetchingSpanMetrics} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({...filters, ...additionalFilters}),
      fields: [`avg(${SPAN_SELF_TIME})`, SPAN_OP],
      enabled: Object.values({...filters, ...additionalFilters}).every(value =>
        Boolean(value)
      ),
    },
    'api.starfish.span-summary-panel-samples-table-avg'
  );

  const spanMetrics = data[0] ?? {};

  const organization = useOrganization();

  const {setPageError} = usePageAlert();

  const {
    data: spans,
    isFetching: isFetchingSamples,
    isEnabled: isSamplesEnabled,
    error: sampleError,
    refetch,
  } = useSpanSamples({
    groupId,
    transactionName,
    transactionMethod,
    subregions,
    release,
    spanSearch,
    additionalFields,
  });

  const {
    data: transactions,
    isFetching: isFetchingTransactions,
    isEnabled: isTransactionsEnabled,
    isPending: isLoadingTransactions,
    error: transactionError,
  } = useTransactions(
    spans.map(span => span['transaction.id']),
    'api.starfish.span-summary-panel-samples-table-transactions'
  );

  const [loadedSpans, setLoadedSpans] = useState(false);
  useEffect(() => {
    if (isLoadingTransactions || isFetchingTransactions || !isTransactionsEnabled) {
      setLoadedSpans(false);
      return;
    }
    if (loadedSpans) {
      return;
    }
    trackAnalytics('starfish.samples.loaded', {
      organization,
      count: transactions?.length ?? 0,
    });
    setLoadedSpans(true);
  }, [
    loadedSpans,
    transactions,
    isFetchingTransactions,
    organization,
    isLoadingTransactions,
    isTransactionsEnabled,
  ]);

  const transactionsById = keyBy(transactions, 'id');

  const areNoSamples = !isFetchingSamples && spans.length === 0;

  const isLoading =
    isFetchingSpanMetrics ||
    isFetchingSamples ||
    !isSamplesEnabled ||
    (!areNoSamples && isFetchingTransactions && !isTransactionsEnabled);

  if (sampleError || transactionError) {
    setPageError(t('An error has occurred while loading the samples table'));
  }

  return (
    <SpanSamplesTableContainer>
      <VisuallyCompleteWithData
        id="SpanSummary.Samples.SampleTable"
        hasData={spans.length > 0}
      >
        <SpanSamplesTable
          groupId={groupId}
          moduleName={moduleName}
          onMouseLeaveSample={onMouseLeaveSample}
          onMouseOverSample={onMouseOverSample}
          highlightedSpanId={highlightedSpanId}
          columnOrder={columnOrder}
          data={spans.map(sample => {
            return {
              ...sample,
              // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              op: spanMetrics[SPAN_OP]!,
              transaction: transactionsById[sample['transaction.id']]!,
            };
          })}
          isLoading={isLoading}
          // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          avg={spanMetrics?.[`avg(${SPAN_SELF_TIME})`]}
          source={referrer}
        />
      </VisuallyCompleteWithData>
      <Button
        onClick={() => {
          trackAnalytics('performance_views.sample_spans.try_different_samples_clicked', {
            organization,
            source: moduleName,
          });
          refetch();
        }}
      >
        {t('Try Different Samples')}
      </Button>
    </SpanSamplesTableContainer>
  );
}

export default SampleTable;
