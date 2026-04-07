import {useMemo} from 'react';

import {
  PlatformCategory,
  profiling as PROFILING_PLATFORMS,
} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import {platformToCategory} from 'sentry/utils/platform';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';

type ColumnInfo = {columnTitles: string[]; fields: string[]};

export const useEventColumns = (group: Group, organization: Organization): ColumnInfo => {
  return useMemo(() => {
    const isPerfIssue = group.issueCategory === IssueCategory.PERFORMANCE;
    const isReplayEnabled =
      organization.features.includes('session-replay') &&
      projectCanLinkToReplay(organization, group.project);

    // profiles only exist on transactions, so this only works with
    // performance issues, and not errors
    const isProfilingEnabled = isPerfIssue && organization.features.includes('profiling');

    const {fields: platformSpecificFields, columnTitles: platformSpecificColumnTitles} =
      getPlatformColumns(group.project.platform ?? group.platform, {
        isProfilingEnabled,
        isReplayEnabled,
      });

    const fields: string[] = [
      'id',
      'timestamp',
      'title',
      'transaction',
      'release',
      'environment',
      'user.display',
      'device',
      'os',
      ...platformSpecificFields,
      'trace',
      ...(isPerfIssue ? ['transaction.duration'] : []),
    ];

    const columnTitles: string[] = [
      t('Event ID'),
      t('Timestamp'),
      t('Title'),
      t('Transaction'),
      t('Release'),
      t('Environment'),
      t('User'),
      t('Device'),
      t('OS'),
      ...platformSpecificColumnTitles,
      t('Trace'),
      ...(isPerfIssue ? [t('Total Duration')] : []),
      t('Minidump'),
    ];

    return {
      fields,
      columnTitles,
    };
  }, [group, organization]);
};

const getPlatformColumns = (
  platform: PlatformKey | undefined,
  options: {isProfilingEnabled: boolean; isReplayEnabled: boolean}
): ColumnInfo => {
  const backendServerlessColumnInfo = {
    fields: ['url', 'runtime'],
    columnTitles: [t('URL'), t('Runtime')],
  };

  const categoryToColumnMap: Record<PlatformCategory, ColumnInfo> = {
    [PlatformCategory.BACKEND]: backendServerlessColumnInfo,
    [PlatformCategory.SERVERLESS]: backendServerlessColumnInfo,
    [PlatformCategory.FRONTEND]: {
      fields: ['url', 'browser'],
      columnTitles: [t('URL'), t('Browser')],
    },
    [PlatformCategory.MOBILE]: {
      fields: ['url'],
      columnTitles: [t('URL')],
    },
    [PlatformCategory.DESKTOP]: {
      fields: [],
      columnTitles: [],
    },
    [PlatformCategory.GAMING]: {
      fields: [],
      columnTitles: [],
    },
    [PlatformCategory.OTHER]: {
      fields: [],
      columnTitles: [],
    },
  };

  const platformCategory = platformToCategory(platform);
  const platformColumns = categoryToColumnMap[platformCategory];

  if (options.isReplayEnabled) {
    platformColumns.fields.push('replayId');
    platformColumns.columnTitles.push(t('Replay'));
  }

  if (options.isProfilingEnabled && platform && PROFILING_PLATFORMS.includes(platform)) {
    platformColumns.columnTitles.push(t('Profile'));
    platformColumns.fields.push('profile.id');
  }

  return platformColumns;
};
