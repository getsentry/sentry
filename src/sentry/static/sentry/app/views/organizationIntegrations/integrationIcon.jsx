import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import PluginIcon from 'app/plugins/components/pluginIcon';

const Icon = styled.img`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  border-radius: 2px;
  display: block;
`;

const IntegrationIcon = ({integration, size}) =>
  integration.icon ? (
    <Icon size={size} src={integration.icon} />
  ) : (
    <PluginIcon size={size} pluginId={integration.provider.key} />
  );

IntegrationIcon.propTypes = {
  integration: PropTypes.object.isRequired,
  size: PropTypes.number,
};

IntegrationIcon.defaultProps = {
  size: 32,
};

export default IntegrationIcon;
