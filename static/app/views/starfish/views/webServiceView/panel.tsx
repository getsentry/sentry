import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import Detail from 'sentry/views/starfish/components/detailPanel';

// For demo purposes. Delete later if necessary
export default function FailureDetailPanel({
  onClose,
  spikeObject,
}: {
  onClose: () => void;
  spikeObject: any;
}) {
  return (
    <Detail detailKey={spikeObject} onClose={onClose}>
      {<QueryDetailBody />}
    </Detail>
  );
}

function QueryDetailBody() {
  return (
    <div>
      <h2>{t('Failure Detail')}</h2>
      <p>
        {t(
          'Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike.'
        )}
      </p>
      <SubHeader>{t('Failure Description')}</SubHeader>
    </div>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
`;
