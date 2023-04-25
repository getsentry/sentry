import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import Detail from 'sentry/views/starfish/components/detailPanel';
import FailureDetailTable from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/failureDetailTable';
import {FailureSpike} from 'sentry/views/starfish/views/webServiceView/types';

// For demo purposes. Delete later if necessary
export default function FailureDetailPanel({
  spike,
  onClose,
}: {
  onClose: () => void;
  spike: FailureSpike;
}) {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <Detail detailKey={spike as any} onClose={onClose}>
      <div>
        <h2>{t('Failure Detail')}</h2>
        <p>
          {t(
            'Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike.'
          )}
        </p>
        <SubHeader>{t('Failure Description')}</SubHeader>
        <FailureDetailTable
          location={location}
          organization={organization}
          // onSelect={() => {}}
        />
      </div>
    </Detail>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
`;
