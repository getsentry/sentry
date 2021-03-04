import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import {IconDelete, IconEdit} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {logException} from 'app/utils/logging';
import withApi from 'app/utils/withApi';

import {Monitor} from './types';

type Props = {
  api: Client;
  monitor: Monitor;
  orgId: string;
  onUpdate: (data: Monitor) => void;
};

const MonitorHeaderActions = ({api, monitor, orgId, onUpdate}: Props) => {
  const handleDelete = () => {
    const redirectPath = `/organizations/${orgId}/monitors/`;
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
          size="small"
          icon={<IconEdit size="xs" />}
          to={`/organizations/${orgId}/monitors/${monitor.id}/edit/`}
        >
          &nbsp;
          {t('Edit')}
        </Button>
        <Button size="small" onClick={toggleStatus}>
          {monitor.status !== 'disabled' ? t('Pause') : t('Enable')}
        </Button>
        <Confirm
          onConfirm={handleDelete}
          message={t(
            'Deleting this monitor is permanent. Are you sure you wish to continue?'
          )}
        >
          <Button size="small" icon={<IconDelete size="xs" />}>
            {t('Delete')}
          </Button>
        </Confirm>
      </ButtonBar>
    </ButtonContainer>
  );
};

const ButtonContainer = styled('div')`
  margin-bottom: ${space(3)};
  display: flex;
  flex-shrink: 1;
`;

export default withApi(MonitorHeaderActions);
