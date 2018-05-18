import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import {PanelItem} from 'app/components/panels';

const IntegrationIcon = styled.img`
  height: 32px;
  width: 32px;
  border-radius: 3px;
  display: block;
`;

const IntegrationName = styled.div`
  font-size: 1.6rem;
  margin-bottom: 3px;
`;

const DomainName = styled.div`
  color: ${p => p.theme.gray3};
  font-size: 1.4rem;
`;

export default class InstalledIntegration extends React.Component {
  static propTypes = {
    provider: PropTypes.object.isRequired,
    integration: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
  };

  render() {
    const {integration} = this.props;

    return (
      <PanelItem p={0} py={2} key={integration.id}>
        <Box pl={2}>
          <IntegrationIcon src={integration.icon} />
        </Box>
        <Box px={2} flex={1}>
          <IntegrationName>{integration.name}</IntegrationName>
          <DomainName>{integration.domain_name}</DomainName>
        </Box>
        <Box mr={1} pr={2}>
          <Confirm
            message={t(
              'Removing this inegration will disable the integration for all projects. Are you sure you want to remove this integration?'
            )}
            onConfirm={() => this.props.onRemove()}
          >
            <Button size="small">
              <span className="icon icon-trash" style={{margin: 0}} />
            </Button>
          </Confirm>
        </Box>
      </PanelItem>
    );
  }
}
