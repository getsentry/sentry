import {Component} from 'react';
import styled from '@emotion/styled';

import PluginIcon, {DEFAULT_ICON, ICON_PATHS} from 'sentry/plugins/components/pluginIcon';
import type {Integration} from 'sentry/types/integrations';

type Props = {
  integration: Integration;
  size?: number;
};

type State = {
  imgSrc: Integration['icon'];
};

type IconProps = Pick<Props, 'size'>;

const StyledIcon = styled('img')<IconProps>`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  border-radius: 2px;
  display: block;
`;

class Icon extends Component<Props, State> {
  state: State = {
    imgSrc: this.props.integration.icon,
  };

  render() {
    const {integration, size} = this.props;

    return (
      <StyledIcon
        size={size}
        src={this.state.imgSrc || undefined}
        onError={() => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          this.setState({imgSrc: ICON_PATHS[integration.provider.key] || DEFAULT_ICON});
        }}
      />
    );
  }
}

function IntegrationIcon({integration, size = 32}: Props) {
  return integration.icon ? (
    <Icon size={size} integration={integration} />
  ) : (
    <PluginIcon size={size} pluginId={integration.provider.key} />
  );
}

export default IntegrationIcon;
