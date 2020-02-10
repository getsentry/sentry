import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import {
  installSentryApp,
  uninstallSentryApp,
} from 'app/actionCreators/sentryAppInstallations';
import AsyncComponent from 'app/components/asyncComponent';
import marked, {singleLineRenderer} from 'app/utils/marked';
import InlineSvg from 'app/components/inlineSvg';
import Tag from 'app/views/settings/components/tag';
import {toPermissions} from 'app/utils/consolidatedScopes';
import CircleIndicator from 'app/components/circleIndicator';
import {
  IntegrationFeature,
  SentryApp,
  Organization,
  SentryAppInstallation,
} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import {getIntegrationFeatureGate} from 'app/utils/integrationUtil';
import SplitInstallationIdModal from 'app/views/organizationIntegrations/SplitInstallationIdModal';
import {openModal} from 'app/actionCreators/modal';
import {UninstallButton} from '../settings/organizationDeveloperSettings/sentryApplicationRow/installButtons';

type State = {
  sentryApp: SentryApp;
  featureData: IntegrationFeature[];
};

type Props = {
  organization: Organization;
} & RouteComponentProps<{appSlug: string}, {}>;

class SentryAppDetailedView extends AsyncComponent<
  Props & AsyncComponent['props'],
  State & AsyncComponent['state']
> {
  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {
      organization,
      params: {appSlug},
    } = this.props;
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      ['sentryApp', `/sentry-apps/${appSlug}/`],
      ['featureData', `/sentry-apps/${appSlug}/features/`],
      ['appInstalls', `/organizations/${organization.slug}/sentry-app-installations/`],
    ];

    return baseEndpoints;
  }

  featureTags(features: IntegrationFeature[]) {
    return features.map(feature => {
      const feat = feature.featureGate.replace(/integrations/g, '');
      return <StyledTag key={feat}>{feat.replace(/-/g, ' ')}</StyledTag>;
    });
  }

  get permissions() {
    return toPermissions(this.state.sentryApp.scopes);
  }

  isInstalled = () => {
    return this.state.appInstalls.find(i => i.app.slug === this.state.sentryApp.slug);
  };

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

    // installSentryApp adds a message on failure
    const install = await installSentryApp(this.api, organization.slug, sentryApp);
    if (!sentryApp.redirectUrl) {
      addSuccessMessage(t(`${sentryApp.slug} successfully installed.`));
      this.setState({appInstalls: [install, ...this.state.appInstalls]});

      //hack for split so we can show the install ID to users for them to copy
      //Will remove once the proper fix is in place
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
      const appInstalls = this.state.appInstalls.filter(
        i => i.app.slug !== this.state.sentryApp.slug
      );
      return this.setState({appInstalls});
    } catch (error) {
      return addErrorMessage(t(`Unable to uninstall ${this.state.sentryApp.name}`));
    }
  };

  renderPermissions() {
    const permissions = this.permissions;
    if (!Object.keys(permissions).some(scope => permissions[scope].length > 0)) {
      return null;
    }

    return (
      <React.Fragment>
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
                resources: permissions.read.join(', '),
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
                resources: permissions.read.join(', '),
              })}
            </Text>
          </Permission>
        )}
      </React.Fragment>
    );
  }

  renderBody() {
    const {organization} = this.props;
    const {featureData, sentryApp} = this.state;

    // Prepare the features list
    const features = (featureData || []).map(f => ({
      featureGate: f.featureGate,
      description: (
        <span dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}} />
      ),
    }));

    const {FeatureList, IntegrationFeatures} = getIntegrationFeatureGate();

    const overview = sentryApp.overview || '';
    const featureProps = {organization, features};

    return (
      <React.Fragment>
        <Flex style={{flexDirection: 'column'}}>
          <Flex>
            <PluginIcon pluginId={sentryApp.slug} size={50} />
            <NameContainer>
              <Name>{sentryApp.name}</Name>
              <Flex>{features.length && this.featureTags(features)}</Flex>
            </NameContainer>
            <IntegrationFeatures {...featureProps}>
              {({disabled, disabledReason}) => (
                <div
                  style={{
                    marginLeft: 'auto',
                    alignSelf: 'center',
                  }}
                >
                  {disabled && <DisabledNotice reason={disabledReason} />}

                  <Access organization={organization} access={['org:integrations']}>
                    {({hasAccess}) => {
                      return !this.isInstalled() ? (
                        <Button
                          size="small"
                          priority="primary"
                          disabled={!hasAccess || disabled}
                          onClick={() => this.handleInstall()}
                          style={{marginLeft: space(1)}}
                          data-test-id="install"
                        >
                          {t('Accept & Install')}
                        </Button>
                      ) : (
                        <UninstallButton
                          install={this.isInstalled()}
                          app={this.state.sentryApp}
                          onClickUninstall={this.handleUninstall}
                          onUninstallModalOpen={() => {}} //TODO: Implement tracking analytics
                        />
                      );
                    }}
                  </Access>
                </div>
              )}
            </IntegrationFeatures>
          </Flex>
          <ul className="nav nav-tabs border-bottom" style={{paddingTop: '30px'}}>
            <li className="active">
              <a>Information</a>
            </li>
          </ul>
          <Description dangerouslySetInnerHTML={{__html: marked(overview)}} />
          <FeatureList {...featureProps} provider={{...sentryApp, key: sentryApp.slug}} />

          {this.renderPermissions()}
          <Footer>
            <Author>{t('Authored By %s', sentryApp.author)}</Author>
          </Footer>
        </Flex>
      </React.Fragment>
    );
  }
}

const Flex = styled('div')`
  display: flex;
`;

const NameContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  padding-left: ${space(2)};
`;

const Name = styled('div')`
  font-weight: bold;
  font-size: 1.4em;
  margin-bottom: ${space(1)};
`;

const Description = styled('div')`
  font-size: 1.5rem;
  line-height: 2.1rem;
  margin-bottom: ${space(2)};

  li {
    margin-bottom: 6px;
  }
`;

const Author = styled('div')`
  color: ${p => p.theme.gray2};
`;

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <div
    style={{
      flex: 1,
      alignItems: 'center',
    }}
    {...p}
  >
    <InlineSvg src="icon-circle-exclamation" size="1.5em" />
    <div style={{marginLeft: `${space(1)}`}}>{reason}</div>
  </div>
))`
  color: ${p => p.theme.red};
  font-size: 0.9em;
`;

const StyledTag = styled(Tag)`
  &:not(:first-child) {
    margin-left: ${space(0.5)};
  }
`;

const Text = styled('p')`
  margin: 0px 6px;
`;

const Permission = styled('div')`
  display: flex;
`;

const Footer = styled('div')`
  display: flex;
  padding: 20px 30px;
  border-top: 1px solid #e2dee6;
  margin: 20px -30px -30px;
  justify-content: space-between;
`;

const Title = styled('p')`
  margin-bottom: ${space(1)};
  font-weight: bold;
`;

const Indicator = styled(p => <CircleIndicator size={7} {...p} />)`
  margin-top: 7px;
  color: ${p => p.theme.success};
`;

export default withOrganization(SentryAppDetailedView);
