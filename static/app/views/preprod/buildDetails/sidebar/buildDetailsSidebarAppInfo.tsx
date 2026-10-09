import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconClock} from '@sentry/icons/clock';
import {IconFile} from '@sentry/icons/file';
import {IconJson} from '@sentry/icons/json';
import {IconLink} from '@sentry/icons/link';
import {IconMobile} from '@sentry/icons/mobile';
import {PlatformIcon} from 'platformicons';

import {CodeBlock} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {getFormat, getFormattedDate, getUtcToSystem} from 'sentry/utils/dates';
import {AppIcon} from 'sentry/views/preprod/components/appIcon';
import {InstallAppButton} from 'sentry/views/preprod/components/installAppButton';
import {type BuildDetailsAppInfo} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getLabels,
  getReadableArtifactTypeLabel,
  getReadableArtifactTypeTooltip,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';

interface BuildDetailsSidebarAppInfoProps {
  appInfo: BuildDetailsAppInfo;
  artifactId: string;
  projectId: string | null;
}

export function BuildDetailsSidebarAppInfo(props: BuildDetailsSidebarAppInfoProps) {
  const labels = getLabels(props.appInfo.platform ?? undefined);

  const datetimeFormat = getFormat({
    seconds: true,
    timeZone: true,
  });

  return (
    <Stack gap="xl">
      <Flex align="center" gap="sm">
        {props.appInfo.name && (
          <Fragment>
            <AppIcon
              appName={props.appInfo.name}
              appIconId={props.appInfo.app_icon_id}
              projectId={props.projectId}
            />
            <Heading as="h3">{props.appInfo.name}</Heading>
          </Fragment>
        )}
      </Flex>

      <Flex wrap="wrap" gap="md">
        <Flex gap="2xs" align="center">
          <Flex justify="center" align="center" width="24px" height="24px">
            {props.appInfo.platform ? (
              <PlatformIcon platform={props.appInfo.platform} alt="" />
            ) : null}
          </Flex>
          <Text>
            {props.appInfo.platform
              ? getReadablePlatformLabel(props.appInfo.platform)
              : ''}
          </Text>
        </Flex>
        {props.appInfo.app_id && (
          <Tooltip title={labels.appId}>
            <Flex gap="2xs" align="center">
              <Flex justify="center" align="center" width="24px" height="24px">
                <IconJson />
              </Flex>
              <Text>{props.appInfo.app_id}</Text>
            </Flex>
          </Tooltip>
        )}
        {(props.appInfo.date_built || props.appInfo.date_added) && (
          <Tooltip
            title={props.appInfo.date_built ? t('App build time') : t('App upload time')}
          >
            <Flex gap="2xs" align="center">
              <Flex justify="center" align="center" width="24px" height="24px">
                <IconClock />
              </Flex>
              <Text>
                {getFormattedDate(
                  getUtcToSystem(props.appInfo.date_built || props.appInfo.date_added),
                  datetimeFormat,
                  {local: true}
                )}
              </Text>
            </Flex>
          </Tooltip>
        )}
        <Tooltip
          title={getReadableArtifactTypeTooltip(props.appInfo.artifact_type ?? null)}
        >
          <Flex gap="2xs" align="center">
            <Flex justify="center" align="center" width="24px" height="24px">
              <IconFile />
            </Flex>
            <Text>
              {getReadableArtifactTypeLabel(props.appInfo.artifact_type ?? null)}
            </Text>
          </Flex>
        </Tooltip>
        <Flex gap="2xs" align="center">
          <Flex justify="center" align="center" width="24px" height="24px">
            <IconLink />
          </Flex>
          <Text>
            {props.projectId ? (
              <InstallAppButton
                projectId={props.projectId}
                artifactId={props.artifactId}
                platform={props.appInfo.platform ?? null}
                source="build_details_sidebar"
              />
            ) : null}
          </Text>
        </Flex>
        {props.appInfo.build_configuration && (
          <Tooltip title={labels.buildConfiguration}>
            <Flex gap="2xs" align="center">
              <Flex justify="center" align="center" width="24px" height="24px">
                <IconMobile />
              </Flex>
              <InlineCodeSnippet data-render-inline hideCopyButton>
                {props.appInfo.build_configuration}
              </InlineCodeSnippet>
            </Flex>
          </Tooltip>
        )}
      </Flex>
    </Stack>
  );
}

const InlineCodeSnippet = styled(CodeBlock)`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
`;
