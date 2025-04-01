import {useState} from 'react';
import styled from '@emotion/styled';

import PluginIcon, {DEFAULT_ICON, ICON_PATHS} from 'sentry/plugins/components/pluginIcon';
import type {Integration} from 'sentry/types/integrations';

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

function Icon({integration, size}: Props) {
  const [imgSrc, setImgSrc] = useState<string | undefined>(integration.icon || undefined);

  const handleError = () => {
    setImgSrc(ICON_PATHS[integration.provider.key] || DEFAULT_ICON);
  };

  return <StyledIcon size={size} src={imgSrc} onError={handleError} />;
}

function IntegrationIcon({integration, size = 32}: Props) {
  return integration.icon ? (
    <Icon size={size} integration={integration} />
  ) : (
    <PluginIcon size={size} pluginId={integration.provider.key} />
  );
}

export default IntegrationIcon;
