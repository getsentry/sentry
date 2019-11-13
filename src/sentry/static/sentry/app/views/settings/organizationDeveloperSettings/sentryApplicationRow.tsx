import React from 'react';
import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import capitalize from 'lodash/capitalize';
import omit from 'lodash/omit';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import ConfirmDelete from 'app/components/confirmDelete';
import SentryTypes from 'app/sentryTypes';
import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import CircleIndicator from 'app/components/circleIndicator';
import PluginIcon from 'app/plugins/components/pluginIcon';
import {openSentryAppDetailsModal, openModal} from 'app/actionCreators/modal';
import SentryAppPublishRequestModal from 'app/components/modals/sentryAppPublishRequestModal';
import {Organization, SentryApp, SentryAppInstallation} from 'app/types';
import {recordInteraction} from 'app/utils/recordSentryAppInteraction';
import theme from 'app/utils/theme';

const INSTALLED = 'Installed';
const NOT_INSTALLED = 'Not Installed';
const PENDING = 'Pending';

type Props = {
  app: SentryApp;
  organization: Organization;
  install?: SentryAppInstallation;
  onInstall?: () => void;
  onUninstall?: (install: SentryAppInstallation) => void;
  onRemoveApp?: (app: SentryApp) => void;
  showInstallationStatus: boolean;
  showAppDashboardLink?: boolean;
  ['data-test-id']?: string;
};

export default class SentryApplicationRow extends React.PureComponent<Props> {
  static propTypes = {
    app: SentryTypes.SentryApplication,
    organization: SentryTypes.Organization.isRequired,
    install: PropTypes.object,
    onInstall: PropTypes.func,
    onUninstall: PropTypes.func,
    onRemoveApp: PropTypes.func,
    showInstallationStatus: PropTypes.bool, //false if we are on the developer settings page where we don't show installation status
    showAppDashboardLink: PropTypes.bool,
  };

  static defaultProps = {
    showInstallationStatus: true,
  };

  get isInternal() {
    return this.props.app.status === 'internal';
  }

  renderUnpublishedAdminButtons() {
    return (
      <ButtonHolder>
        {this.isInternal ? null : this.renderPublishRequest()}
        {this.renderRemoveApp()}
      </ButtonHolder>
    );
  }

  renderDisabledPublishRequestButton(message: string) {
    return (
      <StyledButton disabled title={t(message)} size="small" icon="icon-upgrade">
        {t('Publish')}
      </StyledButton>
    );
  }

  renderDisabledRemoveButton(message: string) {
    return <Button disabled title={t(message)} size="small" icon="icon-trash" />;
  }

  renderAppDashboardLink() {
    const {app, organization} = this.props;

    return (
      <Access isSuperuser>
        <StyledButton
          size="small"
          icon="icon-stats"
          to={`/settings/${organization.slug}/developer-settings/${app.slug}/dashboard`}
        >
          {t('Dashboard')}
        </StyledButton>
      </Access>
    );
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
        {this.props.showAppDashboardLink && this.renderAppDashboardLink()}
        {this.renderDisabledPublishRequestButton(
          'Published integrations cannot be re-published.'
        )}
        {this.renderDisabledRemoveButton('Published integrations cannot be removed.')}
      </ButtonHolder>
    );
  }

  renderRemoveApp() {
    const {app, onRemoveApp} = this.props;
    const message = t(
      `Deleting ${app.slug} will also delete any and all of its installations. \
       This is a permanent action. Do you wish to continue?`
    );
    return (
      <ConfirmDelete
        message={message}
        confirmInput={app.slug}
        priority="danger"
        onConfirm={() => onRemoveApp && onRemoveApp(app)}
      >
        <Button size="small" icon="icon-trash" />
      </ConfirmDelete>
    );
  }

  renderPublishRequest() {
    return (
      <StyledButton icon="icon-upgrade" size="small" onClick={this.handlePublish}>
        {t('Publish')}
      </StyledButton>
    );
  }

  renderUninstallButton() {
    const {install, app, onUninstall} = this.props;
    const message = t(`Are you sure you want to remove the ${app.slug} installation?`);
    return (
      <Confirm
        message={message}
        priority="danger"
        onConfirm={() => onUninstall && install && onUninstall(install)}
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
    const status = this.installationStatus;
    if (this.hideStatus()) {
      return null;
    }
    if (showInstallationStatus) {
      //if internal and we show installation status, we don't show the learn more
      if (isInternal) {
        return <StatusIndicator status={status} isInternal={isInternal} />;
      }
      return (
        <React.Fragment>
          <StatusIndicator status={status} isInternal={false} />
          <StyledLink to="" onClick={this.openLearnMore}>
            {t('Learn More')}
          </StyledLink>
        </React.Fragment>
      );
    }
    return <PublishStatus status={app.status} />;
  }

  get isInstalled() {
    return !!this.props.install;
  }

  handlePublish = () => {
    const {app} = this.props;

    openModal(deps => <SentryAppPublishRequestModal app={app} {...deps} />);
  };

  get installationStatus() {
    if (this.props.install) {
      return capitalize(this.props.install.status);
    }

    return NOT_INSTALLED;
  }

  openLearnMore = () => {
    const {app, onInstall, organization} = this.props;
    const isInstalled = !!this.isInstalled;

    recordInteraction(app.slug, 'sentry_app_viewed');

    onInstall &&
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

    //showInstallationStatus = true on integrations page
    if (showInstallationStatus) {
      //no installation buttons to show if internal
      if (this.isInternal) {
        return null;
      }
      //if installed, render the uninstall button and if installed, render install button
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

const SentryAppName = styled('div')<{hideStatus: boolean}>`
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

const color = {
  [INSTALLED]: 'success',
  [NOT_INSTALLED]: 'gray2',
  [PENDING]: 'yellowOrange',
};

type StatusIndicatorProps = {status: string; theme?: any; isInternal: boolean};

const StatusIndicator = styled(({status, ...props}: StatusIndicatorProps) => {
  //need to omit isInternal
  const propsToPass = omit(props, ['isInternal']);
  return (
    <Flex align="center">
      <CircleIndicator size={6} color={theme[color[status]]} />
      <div {...propsToPass}>{t(`${status}`)}</div>
    </Flex>
  );
})`
  color: ${(props: StatusIndicatorProps) => props.theme[color[props.status]]};
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

type PublishStatusProps = {status: SentryApp['status']; theme?: any};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => {
  return (
    <Flex align="center">
      <div {...props}>{t(`${status}`)}</div>
    </Flex>
  );
})`
  color: ${(props: PublishStatusProps) =>
    props.status === 'published' ? props.theme.success : props.theme.gray2};
  font-weight: light;
  margin-right: ${space(0.75)};
`;

const ButtonHolder = styled('div')`
  flex-direction: row;
  display: flex;
  & > * {
    margin-left: ${space(0.5)};
  }
`;
