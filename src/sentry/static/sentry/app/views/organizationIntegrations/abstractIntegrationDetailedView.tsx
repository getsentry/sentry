import uniq from 'lodash/uniq';
import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {
  Organization,
  IntegrationFeature,
  IntegrationInstallationStatus,
  SentryAppStatus,
} from 'app/types';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import space from 'app/styles/space';
import Tag from 'app/views/settings/components/tag';
import PluginIcon from 'app/plugins/components/pluginIcon';
import InlineSvg from 'app/components/inlineSvg';
import Access from 'app/components/acl/access';
import Tooltip from 'app/components/tooltip';
import {
  getIntegrationFeatureGate,
  trackIntegrationEvent,
  SingleIntegrationEvent,
} from 'app/utils/integrationUtil';
import Alert, {Props as AlertProps} from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import marked, {singleLineRenderer} from 'app/utils/marked';
import IntegrationStatus from './integrationStatus';

type Tab = 'information' | 'configurations';

type AlertType = AlertProps & {
  text: string;
};

type State = {
  tab: Tab;
} & AsyncComponent['state'];

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string; integrationSlug: string}, {}> &
  AsyncComponent['props'];

class AbstractIntegrationDetailedView<
  P extends Props = Props,
  S extends State = State
> extends AsyncComponent<P, S> {
  tabs: Tab[] = ['information', 'configurations'];

  componentDidMount() {
    const {location} = this.props;
    const value =
      location.query.tab === 'configurations' ? 'configurations' : 'information';
    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({tab: value});
  }

  onLoadAllEndpointsSuccess() {
    this.trackIntegrationEvent({
      eventKey: 'integrations.integration_viewed',
      eventName: 'Integrations: Integration Viewed',
      integration_tab: this.state.tab,
    });
  }

  /***
   * Abstract methods defined below
   */

  //The analytics type used in analytics which is snake case
  get integrationType(): 'sentry_app' | 'first_party' | 'plugin' {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get description(): string {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get author(): string | undefined {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get alerts(): AlertType[] {
    //default is no alerts
    return [];
  }

  //Returns a list of the resources displayed at the bottom of the information card
  get resourceLinks(): Array<{title: string; url: string}> {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get installationStatus(): IntegrationInstallationStatus {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get integrationName(): string {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  // Returns an array of RawIntegrationFeatures which is used in feature gating
  // and displaying what the integraiton does
  get featureData(): IntegrationFeature[] {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  onTabChange = (value: Tab) => {
    this.trackIntegrationEvent({
      eventKey: 'integrations.integration_tab_clicked',
      eventName: 'Integrations: Integration Tab Clicked',
      integration_tab: value,
    });
    this.setState({tab: value});
  };

  //Returns the string that is shown as the title of a tab
  getTabDiplay(tab: Tab): string {
    //default is return the tab
    return tab;
  }

  //Render the button at the top which is usually just an installation button
  renderTopButton(
    _disabledFromFeatures: boolean, //from the feature gate
    _userHasAccess: boolean //from user permissions
  ): React.ReactElement {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  //Returns the permission descriptions, only use by Sentry Apps
  renderPermissions(): React.ReactElement | null {
    //default is don't render permissions
    return null;
  }

  //Returns the list of configurations for the integration
  renderConfigurations() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  /***
   * Actually implmeented methods below*
   */

  get integrationSlug() {
    return this.props.params.integrationSlug;
  }

  //Wrapper around trackIntegrationEvent that automatically provides many fields and the org
  trackIntegrationEvent = (
    options: Pick<
      SingleIntegrationEvent,
      'eventKey' | 'eventName' | 'integration_tab'
    > & {
      integration_status?: SentryAppStatus;
      project_id?: string;
    }
  ) => {
    //If we use this intermediate type we get type checking on the things we care about
    const params: Omit<
      Parameters<typeof trackIntegrationEvent>[0],
      'integrations_installed'
    > = {
      view: 'integrations_directory_integration_detail',
      integration: this.integrationSlug,
      integration_type: this.integrationType,
      already_installed: this.installationStatus !== 'Not Installed', //pending counts as installed here
      ...options,
    };
    //type cast here so TS won't complain
    const typeCasted = params as Parameters<typeof trackIntegrationEvent>[0];
    trackIntegrationEvent(typeCasted, this.props.organization);
  };

  //Returns the props as needed by the hooks integrations:feature-gates
  get featureProps() {
    const {organization} = this.props;
    const featureData = this.featureData;

    // Prepare the features list
    const features = featureData.map(f => ({
      featureGate: f.featureGate,
      description: (
        <FeatureListItem
          dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}}
        />
      ),
    }));

    return {organization, features};
  }

  cleanTags() {
    return uniq(
      this.featureData.map(feature =>
        feature.featureGate.replace(/integrations/g, '').replace(/-/g, ' ')
      )
    );
  }

  //Returns the content shown in the top section of the integration detail
  renderTopSection() {
    const {organization} = this.props;

    const {IntegrationFeatures} = getIntegrationFeatureGate();
    const tags = this.cleanTags();
    return (
      <Flex>
        <PluginIcon pluginId={this.integrationSlug} size={50} />
        <NameContainer>
          <Flex>
            <Name>{this.integrationName}</Name>
            <StatusWrapper>
              <IntegrationStatus status={this.installationStatus} />
            </StatusWrapper>
          </Flex>
          <Flex>
            {tags.map(feature => (
              <StyledTag key={feature}>{feature}</StyledTag>
            ))}
          </Flex>
        </NameContainer>
        <IntegrationFeatures {...this.featureProps}>
          {({disabled, disabledReason}) => (
            <DisableWrapper>
              {disabled && <DisabledNotice reason={disabledReason} />}

              <Access organization={organization} access={['org:integrations']}>
                {({hasAccess}) => (
                  <Tooltip
                    title={t(
                      'You must be an organization owner, manager or admin to install this.'
                    )}
                    disabled={hasAccess}
                  >
                    {this.renderTopButton(disabled, hasAccess)}
                  </Tooltip>
                )}
              </Access>
            </DisableWrapper>
          )}
        </IntegrationFeatures>
      </Flex>
    );
  }

  //Returns the tabs divider with the clickable tabs
  renderTabs() {
    //TODO: Convert to styled component
    return (
      <ul className="nav nav-tabs border-bottom" style={{paddingTop: '30px'}}>
        {this.tabs.map(tabName => (
          <li
            key={tabName}
            className={this.state.tab === tabName ? 'active' : ''}
            onClick={() => this.onTabChange(tabName)}
          >
            <a style={{textTransform: 'capitalize'}}>{t(this.getTabDiplay(tabName))}</a>
          </li>
        ))}
      </ul>
    );
  }

  //Returns the information about the integration description and features
  renderInformationCard() {
    const {FeatureList} = getIntegrationFeatureGate();

    return (
      <React.Fragment>
        <Description dangerouslySetInnerHTML={{__html: marked(this.description)}} />
        <FeatureList {...this.featureProps} provider={{key: this.integrationSlug}} />
        {this.renderPermissions()}
        <Metadata>
          {!!this.author && <AuthorName>{t('By %s', this.author)}</AuthorName>}
          <div>
            {this.resourceLinks.map(({title, url}) => (
              <ExternalLink key={url} href={url}>
                {t(title)}
              </ExternalLink>
            ))}
          </div>
        </Metadata>

        {this.alerts.map((alert, i) => (
          <Alert key={i} type={alert.type} icon={alert.icon}>
            <span dangerouslySetInnerHTML={{__html: singleLineRenderer(alert.text)}} />
          </Alert>
        ))}
      </React.Fragment>
    );
  }

  renderBody() {
    return (
      <React.Fragment>
        {this.renderTopSection()}
        {this.renderTabs()}
        {this.state.tab === 'information'
          ? this.renderInformationCard()
          : this.renderConfigurations()}
      </React.Fragment>
    );
  }
}

const Flex = styled('div')`
  display: flex;
`;

const StyledTag = styled(Tag)`
  &:not(:first-child) {
    margin-left: ${space(0.5)};
  }
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

const FeatureListItem = styled('span')`
  line-height: 24px;
`;

const Description = styled('div')`
  font-size: 1.5rem;
  line-height: 2.1rem;
  margin-bottom: ${space(2)};

  li {
    margin-bottom: 6px;
  }
`;

const Metadata = styled(Flex)`
  font-size: 0.9em;
  margin-bottom: ${space(2)};

  a {
    margin-left: ${space(1)};
  }
`;

const AuthorName = styled('div')`
  color: ${p => p.theme.gray2};
  flex: 1;
`;

const StatusWrapper = styled('div')`
  margin-bottom: ${space(1)};
  padding-left: ${space(2)};
  line-height: 1.5em;
`;

const DisableWrapper = styled('div')`
  margin-left: auto;
  align-self: center;
`;

export default AbstractIntegrationDetailedView;
