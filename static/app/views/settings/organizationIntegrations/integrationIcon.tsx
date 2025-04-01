import {useState} from 'react';
import styled from '@emotion/styled';

import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Integration} from 'sentry/types/integrations';

type IconProps = {
  integration: Integration;
  size?: number;
};

function ImageIcon(props: IconProps) {
  const [renderFallback, setRenderFallback] = useState(false);

  if (renderFallback) {
    return (
      <PluginIcon size={props.size} pluginId={props.integration.provider.key || ''} />
    );
  }

  return (
    <StyledIcon
      size={props.size}
      src={props.integration.icon ?? ''}
      onError={() => setRenderFallback(true)}
    />
  );
}

export function IntegrationIcon({integration, size = 32}: IconProps) {
  return integration.icon ? (
    <ImageIcon size={size} integration={integration} />
  ) : (
    <PluginIcon size={size} pluginId={integration.provider.key} />
  );
}

const StyledIcon = styled('img')<Pick<IconProps, 'size'>>`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  border-radius: 2px;
  display: block;
`;
