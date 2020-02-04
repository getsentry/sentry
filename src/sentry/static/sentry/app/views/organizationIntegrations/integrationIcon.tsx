import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import PluginIcon, {ICON_PATHS, DEFAULT_ICON} from 'app/plugins/components/pluginIcon';
import {Integration} from 'app/types';

type Props = {
  integration: Integration;
  size: number;
};

type IconProps = Pick<Props, 'size'>;

const StyledIcon = styled('div')<IconProps>`
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
        onError={() => {
          this.setState({imgSrc: ICON_PATHS[integration.provider.key] || DEFAULT_ICON});
        }}
      >
        {this.state.imgSrc}
      </StyledIcon>
    );
  }
}

const IntegrationIcon = ({integration, size}: Props) =>
  integration.icon ? (
    <Icon size={size} integration={integration} />
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
