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
          <IntegrationIcon size={compact ? 26 : 32} integration={integration} />
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
          <DomainName>{integration.domainName}</DomainName>
        </Labels>
      </Flex>
    );
  }
}

const IntegrationName = styled.div`
  font-size: 1.6rem;
`;

const DomainName = styled.div`
  color: ${p => p.theme.gray3};
  font-size: 1.4rem;
`;

const ExpandedLabels = styled(p => <Box pl={1} {...p} />)`
  display: flex;
  flex-direction: column;

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${DomainName} {
    margin-top: 3px;
  }
`;

const CompactLabels = styled(p => <Box pl={1} {...p} />)`
  display: flex;
  flex-direction: row;
  align-items: center;

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${DomainName} {
    color: ${p => p.theme.gray1};
    margin-left: ${space(1)};
  }
`;

const Labels = p => {
  const {compact, ...props} = p;
  return compact ? <CompactLabels {...props} /> : <ExpandedLabels {...props} />;
};
