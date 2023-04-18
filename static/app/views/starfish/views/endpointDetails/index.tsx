import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import Detail from 'sentry/views/starfish/components/detailPanel';

type EndpointDetailProps = {
  onClose?: () => void;
  spanGroup?: string;
};

export default function EndpointDetail({spanGroup, onClose}: EndpointDetailProps) {
  return (
    <Detail detailKey={spanGroup} onClose={onClose}>
      <h2>{t('Endpoint Detail')}</h2>
      <p>
        {t(
          'Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans.'
        )}
      </p>
      <UrlHeader>{t('Endpoint URL')}</UrlHeader>
      <pre>{'https://localhost:7999/starfish/api/'}</pre>
    </Detail>
  );
}

const UrlHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
`;
