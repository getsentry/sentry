import {PlatformKey} from 'sentry/data/platformCategories';

import {TimeseriesValue} from './core';
import {Commit} from './integrations';
import {User} from './user';

export enum ReleaseStatus {
  Active = 'open',
  Archived = 'archived',
}

export type SourceMapsArchive = {
  id: number;
  type: 'release';
  name: string;
  date: string;
  fileCount: number;
};

export type Artifact = {
  dateCreated: string;
  dist: string | null;
  id: string;
  name: string;
  sha1: string;
  size: number;
  headers: {'Content-Type': string};
};

export type Deploy = {
  id: string;
  name: string;
  url: string;
  environment: string;
  dateStarted: string;
  dateFinished: string;
  version: string;
};

export type VersionInfo = {
  buildHash: string | null;
  description: string;
  package: string | null;
  version: {raw: string};
};

export type BaseRelease = {
  dateReleased: string;
  url: string;
  dateCreated: string;
  version: string;
  shortVersion: string;
  ref: string;
  status: ReleaseStatus;
};

export type Release = BaseRelease &
  ReleaseData & {
    projects: ReleaseProject[];
  };

export type ReleaseWithHealth = BaseRelease &
  ReleaseData & {
    projects: Required<ReleaseProject>[];
  };

type ReleaseData = {
  commitCount: number;
  data: {};
  lastDeploy?: Deploy;
  deployCount: number;
  lastEvent: string;
  firstEvent: string;
  lastCommit?: Commit;
  authors: User[];
  owner?: any; // TODO(ts)
  newGroups: number;
  versionInfo: VersionInfo;
  fileCount: number | null;
  currentProjectMeta: {
    nextReleaseVersion: string | null;
    prevReleaseVersion: string | null;
    sessionsLowerBound: string | null;
    sessionsUpperBound: string | null;
    firstReleaseVersion: string | null;
    lastReleaseVersion: string | null;
  };
  adoptionStages?: Record<
    'string',
    {
      stage: string | null;
      adopted: string | null;
      unadopted: string | null;
    }
  >;
};

export type CurrentRelease = {
  environment: string;
  firstSeen: string;
  lastSeen: string;
  release: Release;
  stats: {
    // 24h/30d is hardcoded in GroupReleaseWithStatsSerializer
    '24h': TimeseriesValue[];
    '30d': TimeseriesValue[];
  };
};

export type ReleaseProject = {
  slug: string;
  name: string;
  id: number;
  platform: PlatformKey;
  platforms: PlatformKey[];
  newGroups: number;
  hasHealthData: boolean;
  healthData?: Health;
};

export type ReleaseMeta = {
  commitCount: number;
  commitFilesChanged: number;
  deployCount: number;
  releaseFileCount: number;
  version: string;
  projects: ReleaseProject[];
  versionInfo: VersionInfo;
  released: string;
};

/**
 * Release health
 */
export type Health = {
  totalUsers: number;
  totalUsers24h: number | null;
  totalProjectUsers24h: number | null;
  totalSessions: number;
  totalSessions24h: number | null;
  totalProjectSessions24h: number | null;
  crashFreeUsers: number | null;
  crashFreeSessions: number | null;
  stats: HealthGraphData;
  sessionsCrashed: number;
  sessionsErrored: number;
  adoption: number | null;
  sessionsAdoption: number | null;
  hasHealthData: boolean;
  durationP50: number | null;
  durationP90: number | null;
};

export type HealthGraphData = Record<string, TimeseriesValue[]>;

export enum ReleaseComparisonChartType {
  CRASH_FREE_USERS = 'crashFreeUsers',
  HEALTHY_USERS = 'healthyUsers',
  ABNORMAL_USERS = 'abnormalUsers',
  ERRORED_USERS = 'erroredUsers',
  CRASHED_USERS = 'crashedUsers',
  CRASH_FREE_SESSIONS = 'crashFreeSessions',
  HEALTHY_SESSIONS = 'healthySessions',
  ABNORMAL_SESSIONS = 'abnormalSessions',
  ERRORED_SESSIONS = 'erroredSessions',
  CRASHED_SESSIONS = 'crashedSessions',
  SESSION_COUNT = 'sessionCount',
  USER_COUNT = 'userCount',
  ERROR_COUNT = 'errorCount',
  TRANSACTION_COUNT = 'transactionCount',
  FAILURE_RATE = 'failureRate',
  SESSION_DURATION = 'sessionDuration',
}

export enum HealthStatsPeriodOption {
  AUTO = 'auto',
  TWENTY_FOUR_HOURS = '24h',
}

export type CrashFreeTimeBreakdown = {
  date: string;
  totalSessions: number;
  crashFreeSessions: number | null;
  crashFreeUsers: number | null;
  totalUsers: number;
}[];
