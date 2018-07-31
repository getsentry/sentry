import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import marked from 'marked';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import Alert from 'app/components/alert';
import Button from 'app/components/buttons/button';
import ExternalLink from 'app/components/externalLink';
import PluginIcon from 'app/plugins/components/pluginIcon';
import Tag from 'app/views/settings/components/tag.jsx';
import space from 'app/styles/space';

const EARLY_ADOPTER_INTEGRATIONS = ['github', 'jira', 'github_enterprise'];

const alertMarkedRenderer = new marked.Renderer();
alertMarkedRenderer.paragraph = s => s;
const alertMarked = text => marked(text, {renderer: alertMarkedRenderer});

class IntegrationDetailsModal extends React.Component {
  static propTypes = {
    closeModal: PropTypes.func.isRequired,
    onAddIntegration: PropTypes.func.isRequired,
    provider: PropTypes.object.isRequired,
  };

  onAddIntegration = integration => {
    this.props.closeModal();
    this.props.onAddIntegration(integration);
  };

  features(features) {
    return features.map(feature => (
      <StyledTag key={feature}>{feature.replace(/_/g, ' ')}</StyledTag>
    ));
  }

  earlyAdopterLabel(provider) {
    return EARLY_ADOPTER_INTEGRATIONS.includes(provider.key) ? (
      <StyledTag priority="attention">Early Adopter</StyledTag>
    ) : null;
  }

  render() {
    const {provider, closeModal} = this.props;
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

    return (
      <React.Fragment>
        <Flex align="center" mb={2}>
          <PluginIcon pluginId={provider.key} size={50} />
          <Flex pl={1} align="flex-start" direction="column" justify="center">
            <ProviderName>{t('%s Integration', provider.name)}</ProviderName>
            <Flex>
              {this.earlyAdopterLabel(provider)}
              {provider.features.length && this.features(provider.features)}
            </Flex>
          </Flex>
        </Flex>
        <Description dangerouslySetInnerHTML={{__html: description}} />
        <Metadata>
          <AuthorName flex={1}>{t('By %s', provider.metadata.author)}</AuthorName>
          <Box>
            <ExternalLink href={metadata.source_url}>{t('View Source')}</ExternalLink>
            <ExternalLink href={metadata.issue_url}>{t('Report Issue')}</ExternalLink>
          </Box>
        </Metadata>

        {alerts.map((alert, i) => (
          <Alert key={i} type={alert.type} icon={alert.icon}>
            <span dangerouslySetInnerHTML={{__html: alertMarked(alert.text)}} />
          </Alert>
        ))}

        <div className="modal-footer">
          <Button size="small" onClick={closeModal}>
            {t('Cancel')}
          </Button>
          {provider.canAdd && (
            <AddIntegrationButton
              css={{marginLeft: space(1)}}
              size="small"
              priority="primary"
              provider={provider}
              onAddIntegration={this.onAddIntegration}
            />
          )}
          {!provider.canAdd &&
            metadata.aspects.externalInstall && (
              <Button
                css={{marginLeft: space(1)}}
                size="small"
                priority="primary"
                icon="icon-exit"
                href={metadata.aspects.externalInstall.url}
                onClick={closeModal}
                external
              >
                {metadata.aspects.externalInstall.buttonText}
              </Button>
            )}
        </div>
      </React.Fragment>
    );
  }
}

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
