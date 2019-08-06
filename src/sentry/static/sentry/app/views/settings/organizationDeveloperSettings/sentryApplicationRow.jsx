import React from 'react';
import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import {omit} from 'lodash';

import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import ConfirmDelete from 'app/components/confirmDelete';
import PropTypes from 'prop-types';
import SentryTypes from 'app/sentryTypes';
import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import styled from 'react-emotion';
import space from 'app/styles/space';
import {withTheme} from 'emotion-theming';
import CircleIndicator from 'app/components/circleIndicator';
import PluginIcon from 'app/plugins/components/pluginIcon';
import {openSentryAppDetailsModal} from 'app/actionCreators/modal';

export default class SentryApplicationRow extends React.PureComponent {
  static propTypes = {
    app: SentryTypes.SentryApplication,
    organization: SentryTypes.Organization.isRequired,
    installs: PropTypes.array,
    onInstall: PropTypes.func,
    onUninstall: PropTypes.func,
    onRemoveApp: PropTypes.func,
    onPublishRequest: PropTypes.func,
    showInstallationStatus: PropTypes.bool, //false if we are on the developer settings page where we don't show installation status
  };

  static defaultProps = {
    showInstallationStatus: true,
  };

  get isInternal() {
    return this.props.app.status === 'internal';
  }

  renderUnpublishedAdminButtons() {
    const {app} = this.props;
    return (
      <ButtonHolder>
        {this.isInternal ? null : this.renderPublishRequest(app)}
        {this.renderRemoveApp(app)}
      </ButtonHolder>
    );
  }

  renderDisabledPublishRequestButton(message) {
    return (
      <StyledButton disabled title={t(message)} size="small" icon="icon-upgrade">
        {t('Publish')}
      </StyledButton>
    );
  }

  renderDisabledRemoveButton(message) {
    return <Button disabled title={t(message)} size="small" icon="icon-trash" />;
  }

  renderUnpublishedNonAdminButtons() {
    return (
      <ButtonHolder>
        {this.renderDisabledPublishRequestButton(
          'Organization owner permissions are required for this action.'
        )}
        {this.renderDisabledRemoveButton(
          'Organization owner permissions are required for this action.'
        )}
      </ButtonHolder>
    );
  }

  renderPublishedAppButtons() {
    return (
      <ButtonHolder>
        {this.renderDisabledPublishRequestButton(
          'Published integrations cannot be re-published.'
        )}
        {this.renderDisabledRemoveButton('Published integrations cannot be removed.')}
      </ButtonHolder>
    );
  }

  renderRemoveApp(app) {
    const message = t(
      `Deleting ${app.slug} will also delete any and all of its installations. \
       This is a permanent action. Do you wish to continue?`
    );
    return (
      <ConfirmDelete
        message={message}
        confirmInput={app.slug}
        priority="danger"
        onConfirm={() => this.props.onRemoveApp(app)}
      >
        <Button size="small" icon="icon-trash" />
      </ConfirmDelete>
    );
  }

  renderPublishRequest(app) {
    const message = t(
      `Sentry will evaluate your integration ${
        app.slug
      } and make it available to all users. \
       Do you wish to continue?`
    );
    return (
      <Confirm
        message={message}
        priority="primary"
        onConfirm={() => this.props.onPublishRequest(app)}
      >
        <StyledButton icon="icon-upgrade" size="small">
          {t('Publish')}
        </StyledButton>
      </Confirm>
    );
  }

  renderUninstallButton() {
    const install = this.props.installs[0];
    const message = t(
      `Are you sure you want to remove the ${install.app.slug} installation ?`
    );
    return (
      <Confirm
        message={message}
        priority="danger"
        onConfirm={() => this.props.onUninstall(install)}
      >
        <StyledButton borderless icon="icon-trash" data-test-id="sentry-app-uninstall">
          {t('Uninstall')}
        </StyledButton>
      </Confirm>
    );
  }

  hideStatus() {
    //no publishing for internal apps so hide the status on the developer settings page
    return this.isInternal && !this.props.showInstallationStatus;
  }

  renderStatus() {
    const {app, showInstallationStatus} = this.props;
    const isInternal = this.isInternal;
    const isInstalled = this.isInstalled;
    if (this.hideStatus()) {
      return null;
    }
    if (showInstallationStatus) {
      //if internal and we show installation status, we don't show the learn more
      if (isInternal) {
        return <Status enabled isInternal={isInternal} />;
      }
      return (
        <React.Fragment>
          <Status enabled={isInstalled} isInternal={false} />
          <StyledLink onClick={this.openLearnMore}>{t('Learn More')}</StyledLink>
        </React.Fragment>
      );
    }
    return <PublishStatus status={app.status} />;
  }

  get isInstalled() {
    return this.props.installs && this.props.installs.length > 0;
  }

  openLearnMore = () => {
    const {app, onInstall, organization} = this.props;
    const isInstalled = !!this.isInstalled;

    openSentryAppDetailsModal({
      sentryApp: app,
      isInstalled,
      onInstall,
      organization,
    });
  };

  renderInstallButton() {
    return (
      <Button
        onClick={() => this.openLearnMore()}
        size="small"
        icon="icon-circle-add"
        className="btn btn-default"
      >
        {t('Install')}
      </Button>
    );
  }

  renderUnpublishedAppButtons() {
    return (
      <Access access={['org:admin']}>
        {({hasAccess}) => (
          <React.Fragment>
            {hasAccess
              ? this.renderUnpublishedAdminButtons()
              : this.renderUnpublishedNonAdminButtons()}
          </React.Fragment>
        )}
      </Access>
    );
  }

  linkToEdit() {
    const {app, showInstallationStatus} = this.props;
    // show the link if the app is internal or we are on the developer settings page
    return app.status === 'internal' || !showInstallationStatus;
  }

  renderButtons() {
    const {app, showInstallationStatus} = this.props;
    const isInstalled = this.isInstalled;

    if (showInstallationStatus) {
      //no installation buttons to show if internal
      if (this.isInternal) {
        return null;
      }
      //if installed, render the uninstall button and if installed, render uninstall
      return isInstalled ? this.renderUninstallButton() : this.renderInstallButton();
    }

    return app.status === 'published'
      ? this.renderPublishedAppButtons()
      : this.renderUnpublishedAppButtons();
  }

  render() {
    const {app, organization} = this.props;

    return (
      <SentryAppItem data-test-id={app.slug}>
        <StyledFlex>
          <PluginIcon size={36} pluginId={app.slug} />
          <SentryAppBox>
            <SentryAppName hideStatus={this.hideStatus()}>
              {this.linkToEdit() ? (
                <SentryAppLink
                  to={`/settings/${organization.slug}/developer-settings/${app.slug}/`}
                >
                  {app.name}
                </SentryAppLink>
              ) : (
                app.name
              )}
            </SentryAppName>
            <SentryAppDetails>{this.renderStatus()}</SentryAppDetails>
          </SentryAppBox>

          <Box>{this.renderButtons()}</Box>
        </StyledFlex>
      </SentryAppItem>
    );
  }
}

const SentryAppItem = styled(PanelItem)`
  flex-direction: column;
  padding: 5px;
`;

const StyledFlex = styled(Flex)`
  justify-content: center;
  padding: 10px;
`;

const SentryAppBox = styled(Box)`
  padding-left: 15px;
  padding-right: 15px;
  flex: 1;
`;

const SentryAppDetails = styled(Flex)`
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

const SentryAppName = styled('div')`
  font-weight: bold;
  margin-top: ${p => (p.hideStatus ? '10px' : '0px')};
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray2};
`;

const SentryAppLink = styled(Link)`
  color: ${props => props.theme.textColor};
`;

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray2};
`;

const Status = styled(
  withTheme(({enabled, ...props}) => {
    //need to omit isInternal
    const propsToPass = omit(props, ['isInternal']);
    return (
      <Flex align="center">
        <CircleIndicator
          size={6}
          color={enabled ? props.theme.success : props.theme.gray2}
        />
        <div {...propsToPass}>{enabled ? t('Installed') : t('Not Installed')}</div>
      </Flex>
    );
  })
)`
  color: ${props => (props.enabled ? props.theme.success : props.theme.gray2)};
  margin-left: ${space(0.5)};
  font-weight: light;
  &:after {
    content: '${props => (props.isInternal ? '' : '|')}';
    color: ${p => p.theme.gray1};
    margin-left: ${space(0.75)};
    font-weight: normal;
  }
  margin-right: ${space(0.75)};
`;

const PublishStatus = styled(({status, ...props}) => {
  return (
    <Flex align="center">
      <div {...props}>{t(`${status}`)}</div>
    </Flex>
  );
})`
  color: ${props =>
    props.status === 'published' ? props.theme.success : props.theme.gray2};
  font-weight: light;
  margin-right: ${space(0.75)};
`;

const ButtonHolder = styled.div`
  flex-direction: row;
  display: flex;
  & > * {
    margin-left: ${space(0.5)};
  }
`;
