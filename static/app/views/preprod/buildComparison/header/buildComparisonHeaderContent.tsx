import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Heading} from 'sentry/components/core/text/heading';
import {IconJson} from 'sentry/icons';
import useOrganization from 'sentry/utils/useOrganization';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getPlatformIconFromPlatform,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';

interface BuildComparisonHeaderContentProps {
  buildDetails: BuildDetailsApiResponse;
  projectId: string;
}

export function BuildComparisonHeaderContent(props: BuildComparisonHeaderContentProps) {
  const {buildDetails, projectId} = props;
  const organization = useOrganization();
  const theme = useTheme();

  const breadcrumbs: Crumb[] = [
    {
      to: '#',
      label: 'Releases',
    },
    {
      to: `/organizations/${organization.slug}/preprod/${projectId}/${buildDetails.id}/`,
      label: buildDetails.app_info.version,
    },
    {
      label: 'Compare',
    },
  ];

  return (
    <Flex direction="column" gap="lg" style={{padding: `0 0 ${theme.space.lg} 0`}}>
      <Breadcrumbs crumbs={breadcrumbs} />
      <Heading as="h1">Build comparison</Heading>
      <Flex gap="lg">
        <Flex gap="sm" align="center">
          <AppIcon>
            <AppIconPlaceholder>
              {buildDetails.app_info.name?.charAt(0) || ''}
            </AppIconPlaceholder>
          </AppIcon>
          <Text>{buildDetails.app_info.name}</Text>
        </Flex>
        <Flex gap="sm" align="center">
          <InfoIcon>
            {buildDetails.app_info.platform ? (
              <PlatformIcon
                platform={getPlatformIconFromPlatform(buildDetails.app_info.platform)}
              />
            ) : null}
          </InfoIcon>
          <Text>
            {buildDetails.app_info.platform
              ? getReadablePlatformLabel(buildDetails.app_info.platform)
              : ''}
          </Text>
        </Flex>
        <Flex gap="sm" align="center">
          <InfoIcon>
            <IconJson />
          </InfoIcon>
          <Text>{buildDetails.app_info.app_id}</Text>
        </Flex>
      </Flex>
    </Flex>
  );
}

const AppIcon = styled('div')`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #ff6600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const AppIconPlaceholder = styled('div')`
  color: white;
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.sm};
`;

const InfoIcon = styled('div')`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;
