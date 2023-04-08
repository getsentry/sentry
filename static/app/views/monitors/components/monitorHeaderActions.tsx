import {browserHistory} from 'react-router';

import {deleteMonitor, updateMonitor} from 'sentry/actionCreators/monitors';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {IconDelete, IconEdit, IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {Monitor, MonitorStatus} from '../types';

import CronsFeedbackButton from './cronsFeedbackButton';

type Props = {
  monitor: Monitor;
  onUpdate: (data: Monitor) => void;
  orgId: string;
};

function MonitorHeaderActions({monitor, orgId, onUpdate}: Props) {
  const api = useApi();

  const handleDelete = async () => {
    await deleteMonitor(api, orgId, monitor.slug);
    browserHistory.push(normalizeUrl(`/organizations/${orgId}/crons/`));
  };

  const handleUpdate = async (data: Partial<Monitor>) => {
    const resp = await updateMonitor(api, orgId, monitor.slug, data);
    onUpdate?.(resp);
  };

  const toggleStatus = () =>
    handleUpdate({
      status:
        monitor.status === MonitorStatus.DISABLED
          ? MonitorStatus.ACTIVE
          : MonitorStatus.DISABLED,
    });

  return (
    <ButtonBar gap={1}>
      <CronsFeedbackButton />
      <Confirm
        onConfirm={handleDelete}
        message={t('Are you sure you want to permanently delete this cron monitor?')}
      >
        <Button size="sm" icon={<IconDelete size="xs" />}>
          {t('Delete')}
        </Button>
      </Confirm>
      <Button
        size="sm"
        icon={
          monitor.status !== 'disabled' ? <IconPause size="xs" /> : <IconPlay size="xs" />
        }
        onClick={toggleStatus}
      >
        {monitor.status !== 'disabled' ? t('Pause') : t('Resume')}
      </Button>
      <Button
        priority="primary"
        size="sm"
        icon={<IconEdit size="xs" />}
        to={`/organizations/${orgId}/crons/${monitor.slug}/edit/`}
      >
        {t('Edit')}
      </Button>
    </ButtonBar>
  );
}

export default MonitorHeaderActions;
