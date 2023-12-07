import {browserHistory} from 'react-router';

import {deleteMonitor, updateMonitor} from 'sentry/actionCreators/monitors';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import {IconDelete, IconEdit, IconSubscribed, IconUnsubscribed} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {Monitor, MonitorStatus} from '../types';

type Props = {
  monitor: Monitor;
  onUpdate: (data: Monitor) => void;
  orgId: string;
};

function MonitorHeaderActions({monitor, orgId, onUpdate}: Props) {
  const api = useApi();
  const {selection} = usePageFilters();

  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
    },
  };

  const handleDelete = async () => {
    await deleteMonitor(api, orgId, monitor.slug);
    browserHistory.push(
      normalizeUrl({
        pathname: `/organizations/${orgId}/crons/`,
        query: endpointOptions.query,
      })
    );
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
      <FeedbackWidgetButton />
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
          monitor.status !== 'disabled' ? (
            <IconUnsubscribed size="xs" />
          ) : (
            <IconSubscribed size="xs" />
          )
        }
        onClick={toggleStatus}
      >
        {monitor.status !== 'disabled' ? t('Mute') : t('Unmute')}
      </Button>
      <Button
        priority="primary"
        size="sm"
        icon={<IconEdit size="xs" />}
        to={{
          pathname: `/organizations/${orgId}/crons/${monitor.slug}/edit/`,
          // TODO(davidenwang): Right now we have to pass the environment
          // through the URL so that when we save the monitor and are
          // redirected back to the details page it queries the backend
          // for a monitor environment with check-in data
          query: {
            environment: selection.environments,
            project: selection.projects,
          },
        }}
      >
        {t('Edit')}
      </Button>
    </ButtonBar>
  );
}

export default MonitorHeaderActions;
