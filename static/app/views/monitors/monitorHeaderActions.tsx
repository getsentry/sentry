import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {logException} from 'sentry/utils/logging';
import useApi from 'sentry/utils/useApi';

import {Monitor} from './types';

type Props = {
  monitor: Monitor;
  onUpdate: (data: Monitor) => void;
  orgId: string;
};

const DISABLED_TOOLTIP_TEXT = t(
  'You must be an organization admin to perform this action'
);

const MonitorHeaderActions = ({monitor, orgId, onUpdate}: Props) => {
  const api = useApi();

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
    <Access access={['project:write']}>
      {({hasAccess}) => (
        <ButtonContainer>
          <ButtonBar gap={1}>
            <Button
              size="sm"
              icon={<IconEdit size="xs" />}
              to={`/organizations/${orgId}/monitors/${monitor.id}/edit/`}
            >
              {hasAccess ? t('Edit') : t('View Config')}
            </Button>
            <Button
              size="sm"
              onClick={toggleStatus}
              disabled={!hasAccess}
              title={DISABLED_TOOLTIP_TEXT}
              tooltipProps={{disabled: hasAccess}}
            >
              {monitor.status !== 'disabled' ? t('Pause') : t('Enable')}
            </Button>
            <Confirm
              onConfirm={handleDelete}
              message={t(
                'Deleting this monitor is permanent. Are you sure you wish to continue?'
              )}
              disabled={!hasAccess}
            >
              <Button
                size="sm"
                icon={<IconDelete size="xs" />}
                title={DISABLED_TOOLTIP_TEXT}
                tooltipProps={{disabled: hasAccess}}
              >
                {t('Delete')}
              </Button>
            </Confirm>
          </ButtonBar>
        </ButtonContainer>
      )}
    </Access>
  );
};

const ButtonContainer = styled('div')`
  margin-bottom: ${space(3)};
  display: flex;
  flex-shrink: 1;
`;

export default MonitorHeaderActions;
