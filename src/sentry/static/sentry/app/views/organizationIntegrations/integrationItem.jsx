import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import IntegrationIcon from 'app/views/organizationIntegrations/integrationIcon';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

export default class IntegrationItem extends React.Component {
  static propTypes = {
    integration: PropTypes.object.isRequired,
    compact: PropTypes.bool,
  };

  render() {
    const {integration, compact} = this.props;

    return (
      <Flex>
        <Box>
          <IntegrationIcon size={compact ? 22 : 32} integration={integration} />
        </Box>
        <Labels compact={compact}>
          <IntegrationName>
            {integration.name}
            {integration.status === 'disabled' && (
              <Tooltip
                title={t(
                  'This Integration has been disconnected from the external provider'
                )}
              >
                <small> — {t('Disabled')}</small>
              </Tooltip>
            )}
          </IntegrationName>
          <DomainName compact={compact}>{integration.domainName}</DomainName>
        </Labels>
      </Flex>
    );
  }
}

const Labels = p => {
  const {compact, ...props} = p;

  return compact ? (
    <Flex align="center" direction="row" pl={1} {...props} />
  ) : (
    <Flex direction="column" pl={1} {...props} />
  );
};

const IntegrationName = styled('div')`
  font-size: 1.6rem;
`;

const DomainName = styled('div')`
  color: ${p => (p.compact ? p.theme.gray1 : p.theme.gray3)};
  margin-left: ${p => (p.compact ? space(1) : 'inherit')};
  margin-top: ${p => (!p.compact ? space(0.25) : 'inherit')};
  font-size: 1.4rem;
`;
