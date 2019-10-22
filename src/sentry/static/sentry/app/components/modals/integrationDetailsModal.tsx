import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import HookStore from 'app/stores/hookStore';
import InlineSvg from 'app/components/inlineSvg';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import Tag from 'app/views/settings/components/tag';
import Tooltip from 'app/components/tooltip';
import marked, {singleLineRenderer} from 'app/utils/marked';
import space from 'app/styles/space';
import {IntegrationDetailsModalOptions} from 'app/actionCreators/modal';
import {Integration} from 'app/types';
import {Hooks} from 'app/types/hooks';

type Props = {
  closeModal: () => void;
} & IntegrationDetailsModalOptions;

/**
 * In sentry.io the features list supports rendering plan details. If the hook
 * is not registered for rendering the features list like this simply show the
 * features as a normal list.
 */
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

class IntegrationDetailsModal extends React.Component<Props> {
  static propTypes = {
    closeModal: PropTypes.func.isRequired,
    onAddIntegration: PropTypes.func.isRequired,
    provider: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  componentDidMount() {
    analytics('integrations.install_modal_opened', {
      org_id: parseInt(this.props.organization.id, 10),
      integration: this.props.provider.key,
    });
  }

  onAddIntegration = (integration: Integration) => {
    this.props.closeModal();
    this.props.onAddIntegration(integration);
  };

  featureTags(features) {
    return features.map(feature => (
      <StyledTag key={feature}>{feature.replace(/-/g, ' ')}</StyledTag>
    ));
  }

  render() {
    const {provider, organization, closeModal} = this.props;
    const {metadata} = provider;
    const description = marked(metadata.description);

    const alerts = metadata.aspects.alerts || [];

    if (!provider.canAdd && metadata.aspects.externalInstall) {
      alerts.push({
        type: 'warning',
        icon: 'icon-exit',
        text: metadata.aspects.externalInstall.noticeText,
      });
    }

    const buttonProps = {
      style: {marginLeft: space(1)},
      size: 'small',
      priority: 'primary',
    };

    const AddButton = p =>
      (provider.canAdd && (
        <AddIntegrationButton
          provider={provider}
          onAddIntegration={this.onAddIntegration}
          {...buttonProps}
          {...p}
        />
      )) ||
      (!provider.canAdd && metadata.aspects.externalInstall && (
        <Button
          icon="icon-exit"
          href={metadata.aspects.externalInstall.url}
          onClick={closeModal}
          external
          {...buttonProps}
          {...p}
        >
          {metadata.aspects.externalInstall.buttonText}
        </Button>
      ));

    // Prepare the features list
    const features = metadata.features.map(f => ({
      featureGate: f.featureGate,
      description: (
        <span dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}} />
      ),
    }));

    const featureListHooks = HookStore.get('integrations:feature-gates');
    featureListHooks.push(() => defaultFeatureGateComponents);

    const {FeatureList, IntegrationFeatures} = featureListHooks[0]();
    const featureProps = {organization, features};

    return (
      <React.Fragment>
        <Flex align="center" mb={2}>
          <PluginIcon pluginId={provider.key} size={50} />
          <Flex pl={1} align="flex-start" direction="column" justify="center">
            <ProviderName data-test-id="provider-name">
              {t('%s Integration', provider.name)}
            </ProviderName>
            <Flex>{provider.features.length && this.featureTags(provider.features)}</Flex>
          </Flex>
        </Flex>
        <Description dangerouslySetInnerHTML={{__html: description}} />
        <FeatureList {...featureProps} provider={provider} />

        <Metadata>
          <AuthorName flex={1}>{t('By %s', provider.metadata.author)}</AuthorName>
          <Box>
            <ExternalLink href={metadata.source_url}>{t('View Source')}</ExternalLink>
            <ExternalLink href={metadata.issue_url}>{t('Report Issue')}</ExternalLink>
          </Box>
        </Metadata>

        {alerts.map((alert, i) => (
          <Alert key={i} type={alert.type} icon={alert.icon}>
            <span dangerouslySetInnerHTML={{__html: singleLineRenderer(alert.text)}} />
          </Alert>
        ))}

        <IntegrationFeatures {...featureProps}>
          {({disabled, disabledReason}) => (
            <div className="modal-footer">
              {disabled && <DisabledNotice reason={disabledReason} />}
              <Button data-test-id="cancel-button" size="small" onClick={closeModal}>
                {t('Cancel')}
              </Button>
              <Access organization={organization} access={['org:integrations']}>
                {({hasAccess}) => (
                  <Tooltip
                    title={t(
                      'You must be an organization owner, manager or admin to install this.'
                    )}
                    disabled={hasAccess}
                  >
                    <AddButton
                      data-test-id="add-button"
                      disabled={disabled || !hasAccess}
                    />
                  </Tooltip>
                )}
              </Access>
            </div>
          )}
        </IntegrationFeatures>
      </React.Fragment>
    );
  }
}

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <Flex align="center" flex={1} {...p}>
    <InlineSvg src="icon-circle-exclamation" size="1.5em" />
    <Box ml={1}>{reason}</Box>
  </Flex>
))`
  color: ${p => p.theme.red};
  font-size: 0.9em;
`;

const ProviderName = styled(p => <Box {...p} />)`
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

const Metadata = styled(Flex)`
  font-size: 0.9em;
  margin-bottom: ${space(2)};

  a {
    margin-left: ${space(1)};
  }
`;

const AuthorName = styled(Box)`
  color: ${p => p.theme.gray2};
`;

const StyledTag = styled(Tag)`
  &:not(:first-child) {
    margin-left: ${space(0.5)};
  }
`;

export default IntegrationDetailsModal;
