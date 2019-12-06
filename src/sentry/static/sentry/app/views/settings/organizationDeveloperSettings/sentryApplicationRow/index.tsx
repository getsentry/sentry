import React from 'react';
import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import capitalize from 'lodash/capitalize';
import omit from 'lodash/omit';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

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
import SentryApplicationRowButtons from './sentryApplicationRowButtons';

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
  isOnIntegrationPage: boolean;
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
    isOnIntegrationPage: PropTypes.bool,
  };

  get isInternal() {
    return this.props.app.status === 'internal';
  }

  hideStatus() {
    //no publishing for internal apps so hide the status on the developer settings page
    return this.isInternal && !this.props.isOnIntegrationPage;
  }

  renderStatus() {
    const {app, isOnIntegrationPage} = this.props;
    const isInternal = this.isInternal;
    const status = this.installationStatus;
    if (this.hideStatus()) {
      return null;
    }
    if (isOnIntegrationPage) {
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

  linkToEdit() {
    const {isOnIntegrationPage} = this.props;
    // show the link if the app is internal or we are on the developer settings page
    // We don't want to show the link to edit on the main integrations list unless the app is internal
    return this.isInternal || !isOnIntegrationPage;
  }

  render() {
    const {
      app,
      organization,
      install,
      isOnIntegrationPage,
      onUninstall,
      onRemoveApp,
    } = this.props;
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

          <Box>
            <SentryApplicationRowButtons
              organization={organization}
              app={app}
              install={install}
              isOnIntegrationPage={isOnIntegrationPage}
              onClickInstall={this.openLearnMore}
              onClickUninstall={onUninstall}
              onClickRemove={onRemoveApp}
              onClickPublish={this.handlePublish}
            />
          </Box>
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
