import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import PluginIcon from 'app/plugins/components/pluginIcon';

const Icon = styled.img`
  height: 32px;
  width: 32px;
  border-radius: 2px;
  display: block;
`;

const IntegrationIcon = ({integration}) =>
  integration.icon ? (
    <Icon src={integration.icon} />
  ) : (
    <PluginIcon size={32} pluginId={integration.provider.key} />
  );

IntegrationIcon.propTypes = {
  integration: PropTypes.object.isRequired,
};

export default IntegrationIcon;
