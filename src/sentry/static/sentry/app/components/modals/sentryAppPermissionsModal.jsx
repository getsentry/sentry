import PropTypes from 'prop-types';
import React from 'react';

import Button from 'app/components/button';
import {t} from 'app/locale';
import {Panel, PanelItem} from 'app/components/panels';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import styled from 'react-emotion';
import ConsolidatedScopes from 'app/utils/consolidatedScopes';

class SentryAppPermissionsModal extends React.Component {
  static propTypes = {
    closeModal: PropTypes.func.isRequired,
    onInstall: PropTypes.func.isRequired,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    Header: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    app: SentryTypes.SentryApplication.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  onInstall() {
    const {onInstall, closeModal} = this.props;
    onInstall();
    closeModal();
  }

  get permissions() {
    return new ConsolidatedScopes(this.props.app.scopes).toPermissions();
  }

  renderPermissions() {
    const permissions = this.permissions;
    return (
      <React.Fragment>
        {permissions.read.length > 0 && (
          <PanelItem key="read">
            <p>
              <strong>{t('Read')}</strong>
              {t(` access to ${permissions.read.join(', ')}`)}
            </p>
          </PanelItem>
        )}
        {permissions.write.length > 0 && (
          <PanelItem key="write">
            <p>
              <strong>{t('Read')}</strong>
              {t(' and ')}
              <strong>{t('write')}</strong>
              {t(` access to ${permissions.write.join(', ')}`)}
            </p>
          </PanelItem>
        )}
        {permissions.admin.length > 0 && (
          <PanelItem key="admin">
            <p>
              <strong>{t('Admin')}</strong>
              {t(` access to ${permissions.admin.join(', ')}`)}
            </p>
          </PanelItem>
        )}
      </React.Fragment>
    );
  }

  render() {
    let {closeModal, app, orgId, Header, Body} = this.props;
    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t(`Install ${app.name}`)}
        </Header>
        <Body>
          <Title>
            {t('Install on your ')}
            <strong>{orgId}</strong>
            {t(' organization with the following permissions:')}
          </Title>
          <Panel>{this.renderPermissions()}</Panel>
        </Body>
        <div className="modal-footer">
          {app.redirectUrl && (
            <RedirectionInfo>
              {t(
                `After installation you'll be redirected to the ${app.name} service to finish setup.`
              )}
            </RedirectionInfo>
          )}
          <StyledButton priority="success" onClick={() => this.onInstall()}>
            {t('Install')}
          </StyledButton>
          <StyledButton onClick={closeModal}>{t('Cancel')}</StyledButton>
        </div>
      </React.Fragment>
    );
  }
}

export default SentryAppPermissionsModal;

const StyledButton = styled(Button)`
  margin-left: ${space(1)};
`;

const Title = styled('p')`
  color: ${p => p.theme.gray5};
`;

const RedirectionInfo = styled('div')`
  padding-right: 5px;
  font-size: 12px;
  color: ${p => p.theme.gray2};
`;
