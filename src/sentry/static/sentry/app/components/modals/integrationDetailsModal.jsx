import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ExternalLink from 'app/components/externalLink';
import HookStore from 'app/stores/hookStore';
import InlineSvg from 'app/components/inlineSvg';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import Tag from 'app/views/settings/components/tag.jsx';
import marked, {singleLineRenderer} from 'app/utils/marked';
import space from 'app/styles/space';

const EARLY_ADOPTER_INTEGRATIONS = [];

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
        <li key={i} dangerouslySetInnerHTML={{__html: p.formatter(f.description)}} />
      ))}
    </ul>
  ),
};

class IntegrationDetailsModal extends React.Component {
  static propTypes = {
    closeModal: PropTypes.func.isRequired,
    onAddIntegration: PropTypes.func.isRequired,
    provider: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  componentDidMount() {
    analytics('integrations.install_modal_opened', {
      org_id: this.props.organization.id,
      integration: this.props.provider.key,
    });
  }

  onAddIntegration = integration => {
    this.props.closeModal();
    this.props.onAddIntegration(integration);
  };

  featureTags(features) {
    return features.map(feature => (
      <StyledTag key={feature}>{feature.replace(/-/g, ' ')}</StyledTag>
    ));
  }

  earlyAdopterLabel(provider) {
    return EARLY_ADOPTER_INTEGRATIONS.includes(provider.key) ? (
      <StyledTag priority="attention">Early Adopter</StyledTag>
    ) : null;
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
      (!provider.canAdd &&
        metadata.aspects.externalInstall && (
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

    const featureListHooks = HookStore.get('integrations:feature-gates');
    featureListHooks.push(() => defaultFeatureGateComponents);

    const {FeatureList, IntegrationFeatures} = featureListHooks[0]();
    const featureProps = {organization, features: metadata.features};

    return (
      <React.Fragment>
        <Flex align="center" mb={2}>
          <PluginIcon pluginId={provider.key} size={50} />
          <Flex pl={1} align="flex-start" direction="column" justify="center">
            <ProviderName>{t('%s Integration', provider.name)}</ProviderName>
            <Flex>
              {this.earlyAdopterLabel(provider)}
              {provider.features.length && this.featureTags(provider.features)}
            </Flex>
          </Flex>
        </Flex>
        <Description dangerouslySetInnerHTML={{__html: description}} />
        <FeatureList {...featureProps} formatter={singleLineRenderer} />

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
              <Button size="small" onClick={closeModal}>
                {t('Cancel')}
              </Button>
              <AddButton disabled={disabled} />
            </div>
          )}
        </IntegrationFeatures>
      </React.Fragment>
    );
  }
}

const DisabledNotice = styled(({reason, ...p}) => (
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

const Description = styled.div`
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
