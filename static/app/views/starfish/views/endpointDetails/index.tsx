import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {DataRow, HOST} from 'sentry/views/starfish/modules/APIModule/APIModuleView';
import {getEndpointDetailQuery} from 'sentry/views/starfish/modules/APIModule/queries';

type EndpointDetailBodyProps = {
  row: DataRow;
};

export default function EndpointDetail({
  row,
  onClose,
}: Partial<EndpointDetailBodyProps> & {onClose: () => void}) {
  return (
    <Detail detailKey={row?.description} onClose={onClose}>
      {row && <EndpointDetailBody row={row} />}
    </Detail>
  );
}

function EndpointDetailBody({row}: EndpointDetailBodyProps) {
  const throughputQuery = getEndpointDetailQuery(row.description);
  useQuery({
    queryKey: ['endpointThroughput'],
    queryFn: () => fetch(`${HOST}/?query=${throughputQuery}`).then(res => res.json()),
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
      <SubHeader>{t('Endpoint URL')}</SubHeader>
      <pre>{row?.description}</pre>
      <SubHeader>{t('Domain')}</SubHeader>
      <pre>{row?.domain}</pre>
    </div>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
`;
