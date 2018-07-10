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
import space from 'app/styles/space';

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

  render() {
    const {provider, closeModal} = this.props;
    const {metadata} = provider;
    const description = marked(metadata.description);

    return (
      <React.Fragment>
        <Flex align="center" mb={2}>
          <PluginIcon pluginId={provider.key} size={32} />
          <ProviderName>{t('%s Integration', provider.name)}</ProviderName>
        </Flex>
        <Description dangerouslySetInnerHTML={{__html: description}} />
        <Metadata>
          <AuthorName flex={1}>{t('By %s', provider.metadata.author)}</AuthorName>
          <Box>
            <ExternalLink href={metadata.source_url}>{t('View Source')}</ExternalLink>
            <ExternalLink href={metadata.issue_url}>{t('Report Issue')}</ExternalLink>
          </Box>
        </Metadata>

        {!provider.canAdd &&
          metadata.aspects.externalInstall && (
            <Alert type="warning" icon="icon-exit">
              {metadata.aspects.externalInstall.noticeText}
            </Alert>
          )}

        {metadata.aspects.alerts &&
          metadata.aspects.alerts.map((alert, i) => (
            <Alert key={i} type={alert.type}>
              {alert.text}
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

const ProviderName = styled(p => <Box pl={1} {...p} />)`
  font-weight: bold;
  font-size: 1.2em;
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

export default IntegrationDetailsModal;
