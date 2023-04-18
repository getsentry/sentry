import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {useQuery} from 'sentry/utils/queryClient';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {DataRow} from 'sentry/views/starfish/modules/cacheModule/cacheTableView';

type CacheDetailBodyProps = {
  row: DataRow;
};

const HOST = 'http://localhost:8080';

const getCacheDetailQuery = description => {
  return `SELECT
  toStartOfInterval(start_timestamp, INTERVAL 5 MINUTE) as interval,
  quantile(0.5)(exclusive_time) as p50,
  quantile(0.95)(exclusive_time) as p95,
  count() as count
  FROM spans_experimental_starfish
  WHERE module = 'cache'
  AND description = '${description}'
  GROUP BY interval
  ORDER BY interval asc
`;
};

export default function CacheDetail({
  row,
  onClose,
}: Partial<CacheDetailBodyProps> & {onClose: () => void}) {
  return (
    <Detail detailKey={row?.desc} onClose={onClose}>
      {row && <EndpointDetailBody row={row} />}
    </Detail>
  );
}

function EndpointDetailBody({row}: CacheDetailBodyProps) {
  const durationQuery = getCacheDetailQuery(row.desc);
  useQuery({
    queryKey: ['cacheDuration'],
    queryFn: () => fetch(`${HOST}/?query=${durationQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  return (
    <div>
      <h2>{t('Command detail')}</h2>
      <p>{t('Detailed summary of redis span.')}</p>
      <SubHeader>{t('Command')}</SubHeader>
      <pre>{row.desc}</pre>
      <SubHeader>{t('Total time spent')}</SubHeader>
      <pre>{row.total_time}ms</pre>
      <SubHeader>{t('p50')}</SubHeader>
      <pre>{row.total_time}ms</pre>
      <SubHeader>{t('p95')}</SubHeader>
      <pre>{row.total_time}ms</pre>
      <SubHeader>{t('list of endpoints that use it')}</SubHeader>
      <pre>{row.total_time}ms</pre>
    </div>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
`;
