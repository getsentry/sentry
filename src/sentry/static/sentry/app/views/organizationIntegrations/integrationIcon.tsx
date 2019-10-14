import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import PluginIcon from 'app/plugins/components/pluginIcon';
import {Integration} from 'app/types';

type Props = {
  integration: Integration;
  size: number;
};

type IconProps = Pick<Props, 'size'>;

const Icon = styled('img')<IconProps>`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  border-radius: 2px;
  display: block;
`;

const IntegrationIcon = ({integration, size}: Props) =>
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
