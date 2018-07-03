import {Box, Flex} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import Tooltip from 'app/components/tooltip';

import IntegrationIcon from 'app/views/organizationIntegrations/integrationIcon';

const IntegrationName = styled.div`
  font-size: 1.6rem;
  margin-bottom: 3px;
`;

const DomainName = styled.div`
  color: ${p => p.theme.gray3};
  font-size: 1.4rem;
`;

export default class IntegrationItem extends React.Component {
  static propTypes = {
    integration: PropTypes.object.isRequired,
  };

  render() {
    const {integration, style} = this.props;
    return (
      <Flex>
        <Box>
          <IntegrationIcon integration={integration} />
        </Box>
        <Box pl={2}>
          <IntegrationName style={style}>
            {integration.name}
            <Tooltip
              title={'This Integration has been disconnected from the external provider'}
            >
              {integration.status === 'disabled' && <small> — Disabled</small>}
            </Tooltip>
          </IntegrationName>
          <DomainName style={style}>{integration.domainName}</DomainName>
        </Box>
      </Flex>
    );
  }
}
