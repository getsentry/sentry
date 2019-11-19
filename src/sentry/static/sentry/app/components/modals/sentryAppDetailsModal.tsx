import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {t, tct} from 'app/locale';

import AsyncComponent from 'app/components/asyncComponent';
import HookStore from 'app/stores/hookStore';
import marked, {singleLineRenderer} from 'app/utils/marked';
import InlineSvg from 'app/components/inlineSvg';
import Tag from 'app/views/settings/components/tag';
import {toPermissions} from 'app/utils/consolidatedScopes';
import CircleIndicator from 'app/components/circleIndicator';
import {SentryAppDetailsModalOptions} from 'app/actionCreators/modal';
import {Hooks} from 'app/types/hooks';
import {IntegrationFeature} from 'app/types';

type Props = {
  closeOnInstall?: boolean;
  closeModal: () => void;
} & SentryAppDetailsModalOptions &
  AsyncComponent['props'];

const defaultFeatureGateComponents = {
  IntegrationFeatures: p =>
    p.children({
      disabled: false,
      disabledReason: null,
      ungatedFeatures: p.features,
      gatedFeatureGroups: [],
    }),
  FeatureList: p => (
    <ul>
      {p.features.map((f, i) => (
        <li key={i}>{f.description}</li>
      ))}
    </ul>
  ),
} as ReturnType<Hooks['integrations:feature-gates']>;

type State = {
  featureData: IntegrationFeature[];
} & AsyncComponent['state'];

export default class SentryAppDetailsModal extends AsyncComponent<Props, State> {
  static propTypes = {
    sentryApp: SentryTypes.SentryApplication.isRequired,
    organization: SentryTypes.Organization.isRequired,
    onInstall: PropTypes.func.isRequired,
    isInstalled: PropTypes.bool.isRequired,
    closeModal: PropTypes.func.isRequired,
    closeOnInstall: PropTypes.bool.isRequired,
  };

  static defaultProps = {
    closeOnInstall: true,
  };

  getEndpoints(): [string, string][] {
    const {sentryApp} = this.props;
    return [['featureData', `/sentry-apps/${sentryApp.slug}/features/`]];
  }

  featureTags(features: IntegrationFeature[]) {
    return features.map(feature => {
      const feat = feature.featureGate.replace(/integrations/g, '');
      return <StyledTag key={feat}>{feat.replace(/-/g, ' ')}</StyledTag>;
    });
  }

  get permissions() {
    return toPermissions(this.props.sentryApp.scopes);
  }

  onInstall() {
    const {onInstall, closeModal, closeOnInstall} = this.props;
    onInstall();
    // let onInstall handle redirection post install when onCloseInstall is false
    closeOnInstall && closeModal();
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
    const {sentryApp, closeModal, isInstalled, organization} = this.props;
    const {featureData} = this.state;
    // Prepare the features list
    const features = (featureData || []).map(f => ({
      featureGate: f.featureGate,
      description: (
        <span dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}} />
      ),
    }));

    const defaultHook = () => defaultFeatureGateComponents;
    const featureHook = HookStore.get('integrations:feature-gates')[0] || defaultHook;
    const {FeatureList, IntegrationFeatures} = featureHook();

    const overview = sentryApp.overview || '';
    const featureProps = {organization, features};

    return (
      <React.Fragment>
        <Flex align="center" mb={2}>
          <PluginIcon pluginId={sentryApp.slug} size={50} />

          <Flex pl={1} align="flex-start" direction="column" justify="center">
            <Name>{sentryApp.name}</Name>
            <Flex>{features.length && this.featureTags(features)}</Flex>
          </Flex>
        </Flex>

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

const Name = styled(Box)`
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

const Author = styled(Box)`
  color: ${p => p.theme.gray2};
`;

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <Flex align="center" flex={1} {...p}>
    <InlineSvg src="icon-circle-exclamation" size="1.5em" />
    <Box ml={1}>{reason}</Box>
  </Flex>
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
