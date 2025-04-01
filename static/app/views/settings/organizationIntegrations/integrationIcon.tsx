import {useState} from 'react';
import styled from '@emotion/styled';

import PluginIcon from 'sentry/plugins/components/pluginIcon';
import type {Integration} from 'sentry/types/integrations';

type IconProps = {
  integration: Integration;
  size?: number;
};

function Icon(props: IconProps) {
  const [imgSrc, setImgSrc] = useState(props.integration.icon || undefined);

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const fallbackIcon = ICON_PATHS[props.integration.provider.key] || DEFAULT_ICON;

  return (
    <StyledIcon size={props.size} src={imgSrc} onError={() => setImgSrc(fallbackIcon)} />
  );
}

export default function IntegrationIcon({integration, size = 32}: IconProps) {
  return integration.icon ? (
    <Icon size={size} integration={integration} />
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
