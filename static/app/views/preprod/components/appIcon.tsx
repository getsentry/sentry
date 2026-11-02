import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {useOrganization} from 'sentry/utils/useOrganization';

interface AppIconProps {
  appName: string;
  appIconId?: string | null;
  projectId?: string | null;
  size?: number;
}

export function AppIcon({appName, appIconId, projectId, size = 24}: AppIconProps) {
  const organization = useOrganization();
  const [imageError, setImageError] = useState(false);

  let iconUrl: string | undefined;
  if (appIconId && projectId) {
    iconUrl = `/api/0/projects/${organization.slug}/${projectId}/files/images/${appIconId}/?image_type=preprod_size_app_icon`;
  }

  return (
    <Fragment>
      {iconUrl && !imageError && (
        <AppIconImg
          src={iconUrl}
          alt="App Icon"
          width={size}
          height={size}
          onError={() => setImageError(true)}
        />
      )}
      {(!iconUrl || imageError) && (
        <AppIconPlaceholder style={{width: size, height: size}}>
          {appName.charAt(0)}
        </AppIconPlaceholder>
      )}
    </Fragment>
  );
}

const AppIconImg = styled('img')`
  border-radius: 4px;
`;

const AppIconPlaceholder = styled('div')`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${p => p.theme.tokens.background.accent.vibrant};
  color: ${p => p.theme.tokens.content.onVibrant.light};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.sm};
`;
