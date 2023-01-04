import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {logException} from 'sentry/utils/logging';
import useApi from 'sentry/utils/useApi';

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
      .requestPromise(`/monitors/${monitor.id}/`, {
        method: 'DELETE',
      })
      .then(() => {
        browserHistory.push(redirectPath);
      })
      .catch(() => {
        addErrorMessage(t('Unable to remove monitor.'));
      });
  };

  const updateMonitor = (data: Partial<Monitor>) => {
    addLoadingMessage();
    api
      .requestPromise(`/monitors/${monitor.id}/`, {
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
    <ButtonContainer>
      <ButtonBar gap={1}>
        <Button
          size="sm"
          icon={<IconEdit size="xs" />}
          to={`/organizations/${orgId}/crons/${monitor.id}/edit/`}
        >
          {t('Edit')}
        </Button>
        <Button size="sm" onClick={toggleStatus}>
          {monitor.status !== 'disabled' ? t('Pause') : t('Enable')}
        </Button>
        <Confirm
          onConfirm={handleDelete}
          message={t('Are you sure you want to permanently delete this cron monitor?')}
        >
          <Button size="sm" icon={<IconDelete size="xs" />}>
            {t('Delete')}
          </Button>
        </Confirm>
        <CronsFeedbackButton />
      </ButtonBar>
    </ButtonContainer>
  );
};

const ButtonContainer = styled('div')`
  margin-bottom: ${space(3)};
  display: flex;
  flex-shrink: 1;
  align-self: flex-end;
`;

export default MonitorHeaderActions;
