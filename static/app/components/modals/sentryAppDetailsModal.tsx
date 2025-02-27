import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import CircleIndicator from 'sentry/components/circleIndicator';
import Tag from 'sentry/components/core/badge/tag';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import SentryAppIcon from 'sentry/components/sentryAppIcon';
import {IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IntegrationFeature, SentryApp} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {toPermissions} from 'sentry/utils/consolidatedScopes';
import {
  getIntegrationFeatureGate,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';

type Props = {
  closeModal: () => void;
  isInstalled: boolean;
  onInstall: () => Promise<void>;
  organization: Organization;
  sentryApp: SentryApp;
} & DeprecatedAsyncComponent['props'];

type State = {
  featureData: IntegrationFeature[];
} & DeprecatedAsyncComponent['state'];

// No longer a modal anymore but yea :)
export default class SentryAppDetailsModal extends DeprecatedAsyncComponent<
  Props,
  State
> {
  componentDidUpdate(prevProps: Props) {
    // if the user changes org, count this as a fresh event to track
    if (this.props.organization.id !== prevProps.organization.id) {
      this.trackOpened();
    }
  }

  componentDidMount() {
    super.componentDidMount();
    this.trackOpened();
  }

  trackOpened() {
    const {sentryApp, organization, isInstalled} = this.props;
    recordInteraction(sentryApp.slug, 'sentry_app_viewed');

    trackIntegrationAnalytics(
      'integrations.install_modal_opened',
      {
        integration_type: 'sentry_app',
        integration: sentryApp.slug,
        already_installed: isInstalled,
        view: 'external_install',
        integration_status: sentryApp.status,
        organization,
      },
      {startSession: true}
    );
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {sentryApp} = this.props;
    return [['featureData', `/sentry-apps/${sentryApp.slug}/features/`]];
  }

  featureTags(features: Array<Pick<IntegrationFeature, 'featureGate'>>) {
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
    // we want to make sure install finishes before we close the modal
    // and we should close the modal if there is an error as well
    try {
      await onInstall();
    } catch (_err) {
      /* stylelint-disable-next-line no-empty-block */
    }
  }

  renderPermissions() {
    const permissions = this.permissions;
    if (
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      Object.keys(permissions).filter(scope => permissions[scope].length > 0).length === 0
    ) {
      return null;
    }

    return (
      <Fragment>
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
      </Fragment>
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
      <Fragment>
        <Heading>
          <SentryAppIcon sentryApp={sentryApp} size={50} />
          <HeadingInfo>
            <Name>{sentryApp.name}</Name>
            {!!features.length && <Features>{this.featureTags(features)}</Features>}
          </HeadingInfo>
        </Heading>
        <Description dangerouslySetInnerHTML={{__html: marked(overview)}} />
        <FeatureList {...featureProps} provider={{...sentryApp, key: sentryApp.slug}} />
        <IntegrationFeatures {...featureProps}>
          {({disabled, disabledReason}) => (
            <Fragment>
              {!disabled && this.renderPermissions()}
              <Footer>
                <Author>{t('Authored By %s', sentryApp.author)}</Author>
                <div>
                  {disabled && <DisabledNotice reason={disabledReason} />}
                  <Button size="sm" onClick={closeModal}>
                    {t('Cancel')}
                  </Button>

                  <Access access={['org:integrations']} organization={organization}>
                    {({hasAccess}) =>
                      hasAccess && (
                        <Button
                          size="sm"
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
            </Fragment>
          )}
        </IntegrationFeatures>
      </Fragment>
    );
  }
}

const Heading = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
  margin-bottom: ${space(2)};
`;

const HeadingInfo = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: ${space(0.75)};
`;

const Name = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: 1.4em;
`;

const Description = styled('div')`
  margin-bottom: ${space(2)};

  li {
    margin-bottom: 6px;
  }
`;

const Author = styled('div')`
  color: ${p => p.theme.gray300};
`;

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <div {...p}>
    <IconFlag color="errorText" size="md" />
    {reason}
  </div>
))`
  display: grid;
  align-items: center;
  flex: 1;
  grid-template-columns: max-content 1fr;
  color: ${p => p.theme.errorText};
  font-size: 0.9em;
`;

const Text = styled('p')`
  margin: 0px 6px;
`;

const Permission = styled('div')`
  display: flex;
`;

const Footer = styled('div')`
  display: flex;
  align-items: center;
  padding: 20px 30px;
  border-top: 1px solid #e2dee6;
  margin: 20px -30px -30px;
  justify-content: space-between;
`;

const Title = styled('p')`
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Indicator = styled((p: any) => <CircleIndicator size={7} {...p} />)`
  margin-top: 7px;
  color: ${p => p.theme.success};
`;

const Features = styled('div')`
  margin: -${space(0.5)};
`;

const StyledTag = styled(Tag)`
  padding: ${space(0.5)};
`;
