import React from 'react';
import styled from '@emotion/styled';

import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import marked, {singleLineRenderer} from 'app/utils/marked';
import {IconFlag} from 'app/icons';
import Tag from 'app/components/tag-deprecated';
import {toPermissions} from 'app/utils/consolidatedScopes';
import CircleIndicator from 'app/components/circleIndicator';
import {IntegrationFeature, SentryApp, Organization} from 'app/types';
import {recordInteraction} from 'app/utils/recordSentryAppInteraction';
import {
  trackIntegrationEvent,
  getIntegrationFeatureGate,
} from 'app/utils/integrationUtil';

type Props = {
  closeModal: () => void;
  sentryApp: SentryApp;
  isInstalled: boolean;
  onInstall: () => Promise<void>;
  organization: Organization;
} & AsyncComponent['props'];

type State = {
  featureData: IntegrationFeature[];
} & AsyncComponent['state'];

//No longer a modal anymore but yea :)
export default class SentryAppDetailsModal extends AsyncComponent<Props, State> {
  componentDidUpdate(prevProps: Props) {
    //if the user changes org, count this as a fresh event to track
    if (this.props.organization.id !== prevProps.organization.id) {
      this.trackOpened();
    }
  }

  componentDidMount() {
    this.trackOpened();
  }

  trackOpened() {
    const {sentryApp, organization, isInstalled} = this.props;
    recordInteraction(sentryApp.slug, 'sentry_app_viewed');

    trackIntegrationEvent(
      {
        eventKey: 'integrations.install_modal_opened',
        eventName: 'Integrations: Install Modal Opened',
        integration_type: 'sentry_app',
        integration: sentryApp.slug,
        already_installed: isInstalled,
        view: 'external_install',
        integration_status: sentryApp.status,
      },
      organization,
      {startSession: true}
    );
  }

  getEndpoints(): [string, string][] {
    const {sentryApp} = this.props;
    return [['featureData', `/sentry-apps/${sentryApp.slug}/features/`]];
  }

  featureTags(features: Pick<IntegrationFeature, 'featureGate'>[]) {
    return features.map(feature => {
      const feat = feature.featureGate.replace(/integrations/g, '');
      return <StyledTag key={feat}>{feat.replace(/-/g, ' ')}</StyledTag>;
    });
  }

  get permissions() {
    return toPermissions(this.props.sentryApp.scopes);
  }

  async onInstall() {
    const {onInstall} = this.props;
    //we want to make sure install finishes before we close the modal
    //and we should close the modal if there is an error as well
    try {
      await onInstall();
    } catch (_err) {
      /* stylelint-disable-next-line no-empty-block */
    }
  }

  renderPermissions() {
    const permissions = this.permissions;
    if (
      Object.keys(permissions).filter(scope => permissions[scope].length > 0).length === 0
    ) {
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
      </React.Fragment>
    );
  }

  renderBody() {
    const {sentryApp, closeModal, isInstalled, organization} = this.props;
    const {featureData} = this.state;
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
        <Heading>
          <PluginIcon pluginId={sentryApp.slug} size={50} />

          <HeadingInfo>
            <Name>{sentryApp.name}</Name>
            <div>{features.length && this.featureTags(features)}</div>
          </HeadingInfo>
        </Heading>

        <Description dangerouslySetInnerHTML={{__html: marked(overview)}} />
        <FeatureList {...featureProps} provider={{...sentryApp, key: sentryApp.slug}} />

        <IntegrationFeatures {...featureProps}>
          {({disabled, disabledReason}) => (
            <React.Fragment>
              {!disabled && this.renderPermissions()}
              <Footer>
                <Author>{t('Authored By %s', sentryApp.author)}</Author>
                <div>
                  {disabled && <DisabledNotice reason={disabledReason} />}
                  <Button size="small" onClick={closeModal}>
                    {t('Cancel')}
                  </Button>

                  <Access organization={organization} access={['org:integrations']}>
                    {({hasAccess}) =>
                      hasAccess && (
                        <Button
                          size="small"
                          priority="primary"
                          disabled={isInstalled || disabled}
                          onClick={() => this.onInstall()}
                          style={{marginLeft: space(1)}}
                          data-test-id="install"
                        >
                          {t('Accept & Install')}
                        </Button>
                      )
                    }
                  </Access>
                </div>
              </Footer>
            </React.Fragment>
          )}
        </IntegrationFeatures>
      </React.Fragment>
    );
  }
}

const Heading = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  margin-bottom: ${space(2)};
`;

const HeadingInfo = styled('div')`
  display: grid;
  grid-template-rows: max-content max-content;
  grid-gap: ${space(0.5)};
  align-items: start;
`;

const Name = styled('div')`
  font-weight: bold;
  font-size: 1.4em;
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
  color: ${p => p.theme.gray500};
`;

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <div {...p}>
    <IconFlag color="red400" size="1.5em" />
    {reason}
  </div>
))`
  display: grid;
  align-items: center;
  flex: 1;
  grid-template-columns: max-content 1fr;
  color: ${p => p.theme.red400};
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
