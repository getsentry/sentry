import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import Detail from 'sentry/views/starfish/components/detailPanel';
import FailureDetailTable from 'sentry/views/starfish/views/webServiceView/failureDetailPanel/failureDetailTable';
import {FailureSpike} from 'sentry/views/starfish/views/webServiceView/types';

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
    <Detail detailKey={spike?.startTimestamp.toString()} onClose={onClose}>
      <div>
        <h2>{t('Error Spike Detail')}</h2>
        <p>
          {t(
            'Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike. Detailed summary of failure rate spike.'
          )}
        </p>
        <FailureDetailTable location={location} organization={organization} />
      </div>
    </Detail>
  );
}
