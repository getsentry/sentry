import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {DataRow} from './databaseTableView';

const HOST = 'http://localhost:8080';

type EndpointDetailBodyProps = {
  row: DataRow;
};

export default function QueryDetail({
  row,
  onClose,
}: Partial<EndpointDetailBodyProps> & {onClose: () => void}) {
  return (
    <Detail detailKey={row?.description} onClose={onClose}>
      {row && <QueryDetailBody row={row} />}
    </Detail>
  );
}

function QueryDetailBody({row}: EndpointDetailBodyProps) {
  const TRANSACTION_QUERY = `select transaction, (divide(count(), divide(1209600.0, 60)) AS epm), quantile(0.75)(exclusive_time) as p75,
    sum(exclusive_time) as total_time
    from default.spans_experimental_starfish
    where startsWith(span_operation, 'db') and span_operation != 'db.redis' and description='${row.desc}'
    group by transaction
    order by -pow(10, floor(log10(count()))), -quantile(0.5)(exclusive_time)
    limit 10
  `;

  const {isLoading: areEndpointsLoading, data: endpointsData} = useQuery({
    queryKey: ['endpointThroughput'],
    queryFn: () => fetch(`${HOST}/?query=${TRANSACTION_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  return (
    <div>
      <h2>{t('Endpoint Detail')}</h2>
      <p>
        {t(
          'Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans.'
        )}
      </p>
    </div>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
`;
