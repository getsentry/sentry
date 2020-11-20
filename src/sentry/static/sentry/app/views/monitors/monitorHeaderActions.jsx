import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import {IconDelete, IconEdit} from 'app/icons';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {logException} from 'app/utils/logging';
import withApi from 'app/utils/withApi';

class MonitorHeaderActions extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    monitor: SentryTypes.Monitor.isRequired,
    orgId: PropTypes.string.isRequired,
    onUpdate: PropTypes.func,
  };

  handleDelete = () => {
    const {api, orgId, monitor} = this.props;
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

  updateMonitor = data => {
    const {api, monitor} = this.props;
    addLoadingMessage();
    api
      .requestPromise(`/monitors/${monitor.id}/`, {
        method: 'PUT',
        data,
      })
      .then(resp => {
        clearIndicators();
        this.props.onUpdate && this.props.onUpdate(resp);
      })
      .catch(err => {
        logException(err);
        addErrorMessage(t('Unable to update monitor.'));
      });
  };

  toggleStatus = () => {
    const {monitor} = this.props;
    this.updateMonitor({
      status: monitor.status === 'disabled' ? 'active' : 'disabled',
    });
  };

  render() {
    const {monitor, orgId} = this.props;
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
          <Button size="small" onClick={this.toggleStatus}>
            {monitor.status !== 'disabled' ? t('Pause') : t('Enable')}
          </Button>
          <Confirm
            onConfirm={this.handleDelete}
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
  }
}

const ButtonContainer = styled('div')`
  margin-bottom: ${space(3)};
  display: flex;
  flex-shrink: 1;
`;

export default withApi(MonitorHeaderActions);
