import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {
  installSentryApp,
  uninstallSentryApp,
} from 'sentry/actionCreators/sentryAppInstallations';
import {Button} from 'sentry/components/button';
import CircleIndicator from 'sentry/components/circleIndicator';
import Confirm from 'sentry/components/confirm';
import type DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import SentryAppIcon from 'sentry/components/sentryAppIcon';
import {IconSubtract} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  IntegrationFeature,
  SentryApp,
  SentryAppInstallation,
} from 'sentry/types/integrations';
import {toPermissions} from 'sentry/utils/consolidatedScopes';
import {getSentryAppInstallStatus} from 'sentry/utils/integrationUtil';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';
import withOrganization from 'sentry/utils/withOrganization';

import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';
import {SplitInstallationIdModal} from './SplitInstallationIdModal';

type State = {
  appInstalls: SentryAppInstallation[];
  featureData: IntegrationFeature[];
  sentryApp: SentryApp;
};

type Tab = AbstractIntegrationDetailedView['state']['tab'];

class SentryAppDetailedView extends AbstractIntegrationDetailedView<
  AbstractIntegrationDetailedView['props'],
  State & AbstractIntegrationDetailedView['state']
> {
  tabs: Tab[] = ['overview'];
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {
      organization,
      params: {integrationSlug},
    } = this.props;
    return [
      ['sentryApp', `/sentry-apps/${integrationSlug}/`],
      ['featureData', `/sentry-apps/${integrationSlug}/features/`],
      ['appInstalls', `/organizations/${organization.slug}/sentry-app-installations/`],
    ];
  }

  onLoadAllEndpointsSuccess() {
    const {
      organization,
      params: {integrationSlug},
      router,
    } = this.props;

    // redirect for internal integrations
    if (this.sentryApp.status === 'internal') {
      router.push(
        `/settings/${organization.slug}/developer-settings/${integrationSlug}/`
      );
      return;
    }

    super.onLoadAllEndpointsSuccess();
    recordInteraction(integrationSlug, 'sentry_app_viewed');
  }

  get integrationType() {
    return 'sentry_app' as const;
  }

  get sentryApp() {
    return this.state.sentryApp;
  }

  get description() {
    return this.state.sentryApp.overview || '';
  }

  get author() {
    return this.sentryApp.author;
  }

  get resourceLinks() {
    // only show links for published sentry apps
    if (this.sentryApp.status !== 'published') {
      return [];
    }
    return [
      {
        title: 'Documentation',
        url: `https://docs.sentry.io/product/integrations/${this.integrationSlug}/`,
      },
    ];
  }

  get permissions() {
    return toPermissions(this.sentryApp.scopes);
  }

  get installationStatus() {
    return getSentryAppInstallStatus(this.install);
  }

  get integrationName() {
    return this.sentryApp.name;
  }

  get featureData() {
    return this.state.featureData;
  }

  get install() {
    return this.state.appInstalls.find(i => i.app.slug === this.sentryApp.slug);
  }

  redirectUser = (install: SentryAppInstallation) => {
    const {organization} = this.props;
    const {sentryApp} = this.state;
    const queryParams = {
      installationId: install.uuid,
      code: install.code,
      orgSlug: organization.slug,
    };
    if (sentryApp.redirectUrl) {
      const redirectUrl = addQueryParamsToExistingUrl(sentryApp.redirectUrl, queryParams);
      window.location.assign(redirectUrl);
    }
  };

  handleInstall = async () => {
    const {organization} = this.props;
    const {sentryApp} = this.state;
    this.trackIntegrationAnalytics('integrations.installation_start', {
      integration_status: sentryApp.status,
    });
    // installSentryApp adds a message on failure
    const install = await installSentryApp(this.api, organization.slug, sentryApp);

    // installation is complete if the status is installed
    if (install.status === 'installed') {
      this.trackIntegrationAnalytics('integrations.installation_complete', {
        integration_status: sentryApp.status,
      });
    }

    if (!sentryApp.redirectUrl) {
      addSuccessMessage(t('%s successfully installed.', sentryApp.slug));
      this.setState({appInstalls: [install, ...this.state.appInstalls]});

      // hack for split so we can show the install ID to users for them to copy
      // Will remove once the proper fix is in place
      if (['split', 'split-dev', 'split-testing'].includes(sentryApp.slug)) {
        openModal(({closeModal}) => (
          <SplitInstallationIdModal
            installationId={install.uuid}
            closeModal={closeModal}
          />
        ));
      }
    } else {
      this.redirectUser(install);
    }
  };

  handleUninstall = async (install: SentryAppInstallation) => {
    try {
      await uninstallSentryApp(this.api, install);
      this.trackIntegrationAnalytics('integrations.uninstall_completed', {
        integration_status: this.sentryApp.status,
      });
      const appInstalls = this.state.appInstalls.filter(
        i => i.app.slug !== this.sentryApp.slug
      );
      return this.setState({appInstalls});
    } catch (error) {
      return addErrorMessage(t('Unable to uninstall %s', this.sentryApp.name));
    }
  };

  recordUninstallClicked = () => {
    const sentryApp = this.sentryApp;
    this.trackIntegrationAnalytics('integrations.uninstall_clicked', {
      integration_status: sentryApp.status,
    });
  };

  renderPermissions() {
    const permissions = this.permissions;
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (!Object.keys(permissions).some(scope => permissions[scope].length > 0)) {
      return null;
    }

    return (
      <PermissionWrapper>
        <Title>Permissions</Title>
        {permissions.read.length > 0 && (
          <Permission>
            <Indicator />
            <Text key="read">
              {tct('[read] access to [resources] resources', {
                read: <strong>Read</strong>,
                resources: permissions.read.join(', '),
              })}
            </Text>
          </Permission>
        )}
        {permissions.write.length > 0 && (
          <Permission>
            <Indicator />
            <Text key="write">
              {tct('[read] and [write] access to [resources] resources', {
                read: <strong>Read</strong>,
                write: <strong>Write</strong>,
                resources: permissions.write.join(', '),
              })}
            </Text>
          </Permission>
        )}
        {permissions.admin.length > 0 && (
          <Permission>
            <Indicator />
            <Text key="admin">
              {tct('[admin] access to [resources] resources', {
                admin: <strong>Admin</strong>,
                resources: permissions.admin.join(', '),
              })}
            </Text>
          </Permission>
        )}
      </PermissionWrapper>
    );
  }

  renderTopButton(disabledFromFeatures: boolean, userHasAccess: boolean) {
    const install = this.install;
    const capitalizedSlug =
      this.integrationSlug.charAt(0).toUpperCase() + this.integrationSlug.slice(1);
    if (install) {
      return (
        <Confirm
          disabled={!userHasAccess}
          message={tct('Are you sure you want to uninstall the [slug] installation?', {
            slug: capitalizedSlug,
          })}
          onConfirm={() => this.handleUninstall(install)} // called when the user confirms the action
          onConfirming={this.recordUninstallClicked} // called when the confirm modal opens
          priority="danger"
        >
          <StyledUninstallButton size="sm" data-test-id="sentry-app-uninstall">
            <IconSubtract isCircled style={{marginRight: space(0.75)}} />
            {t('Uninstall')}
          </StyledUninstallButton>
        </Confirm>
      );
    }

    if (userHasAccess) {
      return (
        <InstallButton
          data-test-id="install-button"
          disabled={disabledFromFeatures}
          onClick={() => this.handleInstall()}
          priority="primary"
          size="sm"
          style={{marginLeft: space(1)}}
        >
          {t('Accept & Install')}
        </InstallButton>
      );
    }

    return this.renderRequestIntegrationButton();
  }

  // no configurations for sentry apps
  renderConfigurations() {
    return null;
  }

  renderIntegrationIcon() {
    return <SentryAppIcon sentryApp={this.sentryApp} size={50} />;
  }
}

const Text = styled('p')`
  margin: 0px 6px;
`;

const Permission = styled('div')`
  display: flex;
`;

const PermissionWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

const Title = styled('p')`
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Indicator = styled((p: any) => <CircleIndicator size={7} {...p} />)`
  align-self: center;
  color: ${p => p.theme.success};
`;

const InstallButton = styled(Button)`
  margin-left: ${space(1)};
`;

const StyledUninstallButton = styled(Button)`
  color: ${p => p.theme.gray300};
  background: ${p => p.theme.background};

  border: ${p => `1px solid ${p.theme.gray300}`};
  box-sizing: border-box;
  box-shadow: 0px 2px 1px rgba(0, 0, 0, 0.08);
  border-radius: 4px;
`;

export default withOrganization(SentryAppDetailedView);
