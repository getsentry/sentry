import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import useOrganization from 'sentry/utils/useOrganization';

interface AppIconProps {
  appName: string;
  appIconId?: string | null;
  projectId?: string | null;
}

export function AppIcon({appName, appIconId, projectId}: AppIconProps) {
  const organization = useOrganization();
  const [imageError, setImageError] = useState(false);

  let iconUrl = undefined;
  if (appIconId && projectId) {
    iconUrl = `/api/0/projects/${organization.slug}/${projectId}/files/images/${appIconId}/`;
  }

  return (
    <Fragment>
      {iconUrl && !imageError && (
        <AppIconImg
          src={iconUrl}
          alt="App Icon"
          width={24}
          height={24}
          onError={() => setImageError(true)}
        />
      )}
      {(!iconUrl || imageError) && (
        <AppIconPlaceholder>{appName.charAt(0)}</AppIconPlaceholder>
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
  background: ${p => p.theme.purple400};
  color: ${p => p.theme.white};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.sm};
`;
