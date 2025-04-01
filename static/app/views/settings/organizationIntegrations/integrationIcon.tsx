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

function Icon(props: Props) {
  const [imgSrc, setImgSrc] = useState(props.integration.icon || undefined);

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const fallbackIcon = ICON_PATHS[props.integration.provider.key] || DEFAULT_ICON;

  const handleError = () => {
    setImgSrc(fallbackIcon);
  };

  return <StyledIcon size={props.size} src={imgSrc} onError={handleError} />;
}

function IntegrationIcon({integration, size = 32}: Props) {
  return integration.icon ? (
    <Icon size={size} integration={integration} />
  ) : (
    <PluginIcon size={size} pluginId={integration.provider.key} />
  );
}

export default IntegrationIcon;
