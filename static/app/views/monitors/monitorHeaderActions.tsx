import {browserHistory} from 'react-router';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {IconDelete, IconEdit, IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {logException} from 'sentry/utils/logging';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import CronsFeedbackButton from './cronsFeedbackButton';
import {Monitor} from './types';

type Props = {
  monitor: Monitor;
  onUpdate: (data: Monitor) => void;
  orgId: string;
};

const MonitorHeaderActions = ({monitor, orgId, onUpdate}: Props) => {
  const api = useApi();

  const handleDelete = () => {
    const redirectPath = `/organizations/${orgId}/crons/`;
    addLoadingMessage(t('Deleting Monitor...'));

    api
      .requestPromise(`/organizations/${orgId}/monitors/${monitor.id}/`, {
        method: 'DELETE',
      })
      .then(() => {
        browserHistory.push(normalizeUrl(redirectPath));
      })
      .catch(() => {
        addErrorMessage(t('Unable to remove monitor.'));
      });
  };

  const updateMonitor = (data: Partial<Monitor>) => {
    addLoadingMessage();
    api
      .requestPromise(`/organizations/${orgId}/monitors/${monitor.id}/`, {
        method: 'PUT',
        data,
      })
      .then(resp => {
        clearIndicators();
        onUpdate?.(resp);
      })
      .catch(err => {
        logException(err);
        addErrorMessage(t('Unable to update monitor.'));
      });
  };

  const toggleStatus = () =>
    updateMonitor({
      status: monitor.status === 'disabled' ? 'active' : 'disabled',
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
        to={`/organizations/${orgId}/crons/${monitor.id}/edit/`}
      >
        {t('Edit')}
      </Button>
    </ButtonBar>
  );
};

export default MonitorHeaderActions;
