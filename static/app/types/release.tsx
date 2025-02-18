import type {TimeseriesValue} from './core';
import type {Commit} from './integrations';
import type {PlatformKey} from './project';
import type {User} from './user';

export enum ReleaseStatus {
  ACTIVE = 'open',
  ARCHIVED = 'archived',
}

export type SourceMapsArchive = {
  date: string;
  fileCount: number;
  id: number;
  name: string;
  type: 'release';
};

export type Artifact = {
  dateCreated: string;
  dist: string | null;
  headers: {'Content-Type': string} | Record<string, unknown>;
  id: string;
  name: string;
  sha1: string;
  size: number;
};

export type Deploy = {
  dateFinished: string;
  dateStarted: string;
  environment: string;
  id: string;
  name: string;
  url: string;
  version: string;
};

interface RawVersion {
  raw: string;
}

export interface SemverVersion extends RawVersion {
  buildCode: string | null;
  components: number;
  major: number;
  minor: number;
  patch: number;
  pre: string | null;
}

export type VersionInfo = {
  buildHash: string | null;
  description: string;
  package: string | null;
  version: RawVersion | SemverVersion;
};

export interface BaseRelease {
  dateCreated: string;
  dateReleased: string;
  id: string;
  ref: string;
  shortVersion: string;
  status: ReleaseStatus;
  url: string;
  version: string;
}

export interface Release extends BaseRelease, ReleaseData {
  projects: ReleaseProject[];
}

export interface ReleaseWithHealth extends BaseRelease, ReleaseData {
  projects: Array<Required<ReleaseProject>>;
}

interface ReleaseData {
  authors: Array<User | {email: string; name: string}>;
  commitCount: number;
  currentProjectMeta: {
    firstReleaseVersion: string | null;
    lastReleaseVersion: string | null;
    nextReleaseVersion: string | null;
    prevReleaseVersion: string | null;
    sessionsLowerBound: string | null;
    sessionsUpperBound: string | null;
  };
  data: Record<string, unknown>;
  deployCount: number;
  fileCount: number | null;
  firstEvent: string;
  lastEvent: string;
  // TODO(ts)
  newGroups: number;
  versionInfo: VersionInfo;
  adoptionStages?: Record<
    string,
    {
      adopted: string | null;
      stage: string | null;
      unadopted: string | null;
    }
  >;
  lastCommit?: Commit;
  lastDeploy?: Deploy;
  owner?: any;
  userAgent?: string;
}

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
  id: number;
  name: string;
  newGroups: number;
  platform: PlatformKey;
  platforms: PlatformKey[];
  slug: string;
  hasHealthData?: boolean;
  healthData?: Health;
};

export type ReleaseMeta = {
  commitCount: number;
  commitFilesChanged: number;
  deployCount: number;
  isArtifactBundle: boolean;
  newGroups: number;
  projects: ReleaseProject[];
  releaseFileCount: number;
  released: string;
  version: string;
  versionInfo: VersionInfo;
};

/**
 * Release health
 */
export type Health = {
  adoption: number | null;
  crashFreeSessions: number | null;
  crashFreeUsers: number | null;
  durationP50: number | null;
  durationP90: number | null;
  hasHealthData: boolean;
  sessionsAdoption: number | null;
  sessionsCrashed: number;
  sessionsErrored: number;
  stats: HealthGraphData;
  totalProjectSessions24h: number | null;
  totalProjectUsers24h: number | null;
  totalSessions: number;
  totalSessions24h: number | null;
  totalUsers: number;
  totalUsers24h: number | null;
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
}

export enum HealthStatsPeriodOption {
  AUTO = 'auto',
  TWENTY_FOUR_HOURS = '24h',
}

export type CrashFreeTimeBreakdown = Array<{
  crashFreeSessions: number | null;
  crashFreeUsers: number | null;
  date: string;
  totalSessions: number;
  totalUsers: number;
}>;
