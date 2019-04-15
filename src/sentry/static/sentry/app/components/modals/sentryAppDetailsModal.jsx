import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {t} from 'app/locale';

export default class SentryAppDetailsModal extends React.Component {
  static propTypes = {
    sentryApp: SentryTypes.SentryApplication.isRequired,
    organization: SentryTypes.Organization.isRequired,
    onInstall: PropTypes.func.isRequired,
    isInstalled: PropTypes.bool.isRequired,
    closeModal: PropTypes.func.isRequired,
  };

  render() {
    const {sentryApp, closeModal, onInstall, isInstalled, organization} = this.props;

    return (
      <React.Fragment>
        <Flex align="center" mb={2}>
          <PluginIcon pluginId={sentryApp.slug} size={50} />

          <Flex pl={1} align="flex-start" direction="column" justify="center">
            <Name>{sentryApp.name}</Name>
          </Flex>
        </Flex>

        <Description>{sentryApp.overview}</Description>

        <Metadata>
          <Author flex={1}>{t('By %s', sentryApp.author)}</Author>
        </Metadata>

        <div className="modal-footer">
          <Button size="small" onClick={closeModal}>
            {t('Cancel')}
          </Button>

          <Access organization={organization} access={['org:integrations']}>
            {({hasAccess}) =>
              hasAccess && (
                <Button
                  size="small"
                  priority="primary"
                  disabled={isInstalled}
                  onClick={onInstall}
                  style={{marginLeft: space(1)}}
                >
                  {t('Install')}
                </Button>
              )
            }
          </Access>
        </div>
      </React.Fragment>
    );
  }
}

const Name = styled(Box)`
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

const Author = styled(Box)`
  color: ${p => p.theme.gray2};
`;
