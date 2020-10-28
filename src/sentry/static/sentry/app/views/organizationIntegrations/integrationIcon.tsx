import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import PluginIcon, {ICON_PATHS, DEFAULT_ICON} from 'app/plugins/components/pluginIcon';
import {Integration} from 'app/types';

type Props = {
  integration: Integration;
  size?: number;
};

type IconProps = Pick<Props, 'size'>;

const StyledIcon = styled('img')<IconProps>`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  border-radius: 2px;
  display: block;
`;

class Icon extends React.Component<Props> {
  state = {
    imgSrc: this.props.integration.icon,
  };

  render() {
    const {integration, size} = this.props;

    return (
      <StyledIcon
        size={size}
        src={this.state.imgSrc}
        onError={() => {
          this.setState({imgSrc: ICON_PATHS[integration.provider.key] || DEFAULT_ICON});
        }}
      />
    );
  }
}

const IntegrationIcon = ({integration, size = 32}: Props) =>
  integration.icon ? (
    <Icon size={size} integration={integration} />
  ) : (
    <PluginIcon size={size} pluginId={integration.provider.key} />
  );

IntegrationIcon.propTypes = {
  integration: PropTypes.object.isRequired,
  size: PropTypes.number,
};

export default IntegrationIcon;
