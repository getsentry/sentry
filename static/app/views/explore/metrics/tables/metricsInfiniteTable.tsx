import {useCallback, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {useInfiniteTraceMetricsQuery} from 'sentry/views/explore/metrics/useTraceMetricsQuery';

export function MetricsInfiniteTable() {
  const {data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage} =
    useInfiniteTraceMetricsQuery({
      referrer: 'api.explore.metrics.infinite-table',
    });

  const observerTarget = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.5,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  if (isLoading) {
    return <div>{t('Loading metric samples...')}</div>;
  }

  if (error) {
    return <div>{t('Error loading metric samples')}</div>;
  }

  return (
    <TableWrapper>
      <Table>
        <thead>
          <tr>
            <th>{t('Timestamp')}</th>
            <th>{t('Metric Name')}</th>
            <th>{t('Type')}</th>
            <th>{t('Value')}</th>
            <th>{t('Trace ID')}</th>
            <th>{t('Environment')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((metric, index) => (
            <tr key={`${metric[TraceMetricKnownFieldKey.ID]}-${index}`}>
              <td>{metric[TraceMetricKnownFieldKey.TIMESTAMP]}</td>
              <td>{metric[TraceMetricKnownFieldKey.METRIC_NAME]}</td>
              <td>{metric[TraceMetricKnownFieldKey.METRIC_TYPE]}</td>
              <td>{metric[TraceMetricKnownFieldKey.METRIC_VALUE]}</td>
              <td>{metric[TraceMetricKnownFieldKey.TRACE_ID] || t('(none)')}</td>
              <td>{metric[TraceMetricKnownFieldKey.ENVIRONMENT] || t('(none)')}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div ref={observerTarget} style={{height: '20px'}}>
        {isFetchingNextPage && <div>{t('Loading more...')}</div>}
      </div>
    </TableWrapper>
  );
}

const TableWrapper = styled('div')`
  flex: 1;
  overflow: auto;
`;

const Table = styled('table')`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: ${space(1)};
    text-align: left;
    border-bottom: 1px solid ${p => p.theme.border};
  }

  th {
    font-weight: 600;
    background: ${p => p.theme.backgroundSecondary};
  }

  tbody tr:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;
