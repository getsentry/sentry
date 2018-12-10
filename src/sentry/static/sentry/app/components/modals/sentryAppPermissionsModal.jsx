import PropTypes from 'prop-types';
import React from 'react';

import Button from 'app/components/button';
import {capitalize} from 'lodash';
import {t} from 'app/locale';
import {Panel, PanelItem} from 'app/components/panels';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import styled from 'react-emotion';

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

  getTopScopes() {
    // this finds the highest scope permission (read < write < admin)
    // for each resource (org, project, team, member, event) and returns
    // a map with the resource as the key and scope as the value.
    //
    // project:releases is a weird one off scope where either you
    // have it or you don't, so that's set to 'true' when in the scope list
    // and not set at all if it's not.
    //
    // i.e ['project:read', 'project:releases', project:'write', 'org:read']
    // becomes {'project': 'write', 'releases': true, 'org': 'read'}

    let resources = {};
    const LEVELS = {
      read: 0,
      write: 1,
      admin: 2,
    };
    this.props.app.scopes.forEach(scope => {
      let [item, level] = scope.split(':');
      if (level === 'releases') {
        resources.releases = true;
        return;
      }
      const currentLevel = resources[item];
      if (currentLevel && LEVELS[currentLevel] < LEVELS[level]) {
        resources[item] = level;
      } else if (!currentLevel) {
        resources[item] = level;
      }
    });
    return resources;
  }

  getPermissions() {
    let permissions = {};
    const topScopes = this.getTopScopes();
    Object.entries(topScopes).forEach(([resource, scope]) => {
      // releases are a weird one off permission scope, either you
      // have project:releases or you don't so we'll add it to Admin
      // if that scope is present
      if (resource === 'releases') {
        if (permissions.admin) {
          permissions.admin.push('Releases');
        } else {
          permissions.admin = ['Releases'];
        }
        return;
      }
      if (!permissions[scope]) {
        permissions[scope] = [capitalize(resource)];
        return;
      }
      permissions[scope].push(capitalize(resource));
    });
    return permissions;
  }

  renderPermissions() {
    const permissions = this.getPermissions();
    return (
      <React.Fragment>
        {permissions.read && (
          <PanelItem key="read">
            <p>
              <strong>{t('Read')}</strong>
              {t(` access to ${permissions.read.join(', ')}`)}
            </p>
          </PanelItem>
        )}
        {permissions.write && (
          <PanelItem key="write">
            <p>
              <strong>{t('Read')}</strong>
              {t(' and ')}
              <strong>{t('write')}</strong>
              {t(` access to ${permissions.write.join(', ')}`)}
            </p>
          </PanelItem>
        )}
        {permissions.admin && (
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
          {!app.redirectUrl && (
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
