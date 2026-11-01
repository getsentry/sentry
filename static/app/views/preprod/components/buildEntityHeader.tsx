import {IconClock} from '@sentry/icons/clock';
import {IconFile} from '@sentry/icons/file';
import {IconJson} from '@sentry/icons/json';
import {IconTag} from '@sentry/icons/tag';

import {Tag} from '@sentry/scraps/badge';
import {EntityHeader} from '@sentry/scraps/entityHeader';
import type {EntityHeaderProps} from '@sentry/scraps/entityHeader';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import {AppIcon} from 'sentry/views/preprod/components/appIcon';
import type {BuildDetailsAppInfo} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getBuildNumber} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getLabels,
  getReadableArtifactTypeLabel,
  getReadableArtifactTypeTooltip,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';

interface BuildEntityHeaderProps {
  projectSlug: string;
  appInfo?: BuildDetailsAppInfo;
  isLoading?: boolean;
  /**
   * Measurements about the build, right-aligned beside the title. Only the
   * comparison page has them; build details leaves the row off.
   */
  stats?: EntityHeaderProps['stats'];
}

function getVersionTitle(appInfo: BuildDetailsAppInfo | undefined) {
  const version = appInfo?.version;
  if (!version) {
    return null;
  }

  const buildNumber = getBuildNumber(appInfo);
  return buildNumber ? `v${version} (${buildNumber})` : `v${version}`;
}

/**
 * The entity context band shared by the build details and build comparison
 * pages: which build this is, and the facts about the app it came from.
 */
export function BuildEntityHeader({
  appInfo,
  projectSlug,
  isLoading,
  stats,
}: BuildEntityHeaderProps) {
  const platform = appInfo?.platform ?? null;
  const labels = getLabels(platform ?? undefined);
  const dateBuiltOrAdded = appInfo?.date_built || appInfo?.date_added;

  return (
    <EntityHeader
      isLoading={isLoading}
      stats={stats}
      title={{
        type: 'text',
        label: t('Build version'),
        value: getVersionTitle(appInfo) ?? t('Unknown version'),
        leadingGraphic: platform
          ? {
              type: 'platform',
              platform,
              label: t('Platform, %s', getReadablePlatformLabel(platform)),
            }
          : undefined,
        tags: [
          appInfo?.build_configuration ? (
            <Tag key="build-configuration" variant="muted" icon={<IconTag />}>
              <Tooltip title={labels.buildConfiguration}>
                {appInfo.build_configuration}
              </Tooltip>
            </Tag>
          ) : null,
        ],
      }}
      metadata={{
        label: t('Build properties'),
        items: [
          appInfo?.name
            ? {
                type: 'text',
                label: t('App Name'),
                value: appInfo.name,
                leadingGraphic: (
                  <AppIcon
                    appName={appInfo.name}
                    appIconId={appInfo.app_icon_id}
                    projectId={projectSlug}
                    size={16}
                  />
                ),
              }
            : null,
          appInfo?.app_id
            ? {
                type: 'text',
                label: labels.appId,
                value: appInfo.app_id,
                tooltip: labels.appId,
                leadingGraphic: <IconJson size="md" />,
              }
            : null,
          {
            type: 'text',
            label: t('Artifact type'),
            value: getReadableArtifactTypeLabel(appInfo?.artifact_type ?? null),
            tooltip: getReadableArtifactTypeTooltip(appInfo?.artifact_type ?? null),
            leadingGraphic: <IconFile size="md" />,
          },
          dateBuiltOrAdded
            ? {
                type: 'text',
                label: appInfo?.date_built ? t('Built') : t('Uploaded'),
                value: <DateTime date={dateBuiltOrAdded} seconds timeZone />,
                leadingGraphic: <IconClock size="md" />,
              }
            : null,
        ],
      }}
    />
  );
}
