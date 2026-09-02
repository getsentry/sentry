import type {Actor} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  CronDetector,
  ErrorDetector,
  MetricDetector,
  PreprodDetector,
  UptimeDetector,
} from 'sentry/types/workflowEngine/detectors';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {UptimeMonitorMode} from 'sentry/views/detectors/components/uptime/types';
import {MonitorStatus, ScheduleType} from 'sentry/views/insights/crons/types';

/**
 * Fixtures for the monitor embed story and its tests. Entirely synthetic --
 * no real customer names, emails, org slugs, or ids -- but shaped like real
 * monitors so the story renders something worth looking at.
 */

const STORY_TEAM: Project['team'] = {
  id: '1',
  slug: 'web-platform',
  name: 'Web Platform',
  access: ['team:read'],
  teamRole: null,
  isMember: true,
  memberCount: 6,
  avatar: {avatarType: 'letter_avatar', avatarUuid: 'story-team-avatar'},
  flags: {'idp:provisioned': false},
  externalTeams: [],
  hasAccess: true,
  isPending: false,
};

export const STORY_PROJECT: Project = {
  id: '1',
  slug: 'storefront',
  name: 'Storefront',
  access: ['project:read'],
  hasAccess: true,
  isMember: true,
  isBookmarked: false,
  platforms: ['javascript-react'],
  team: STORY_TEAM,
  teams: [STORY_TEAM],
  environments: ['production'],
  features: [],
  dateCreated: '2024-01-08T00:00:00.000Z',
  firstEvent: '2024-01-08T00:05:00.000Z',
  firstTransactionEvent: true,
  hasFeedbacks: false,
  hasNewFeedbacks: false,
  hasMinifiedStackTrace: true,
  hasProfiles: false,
  hasReplays: true,
  hasFlags: false,
  hasTraceMetrics: false,
  hasSessions: true,
  hasMonitors: true,
  hasLogs: false,
  hasInsightsHttp: true,
  hasInsightsDb: true,
  hasInsightsAssets: false,
  hasInsightsAppStart: false,
  hasInsightsScreenLoad: false,
  hasInsightsVitals: false,
  hasInsightsCaches: false,
  hasInsightsQueues: false,
  hasInsightsAgentMonitoring: false,
  hasInsightsMCP: false,
};

const STORY_TEAM_OWNER: Actor = {id: '1', name: 'Web Platform', type: 'team'};

const BASE_DETECTOR = {
  workflowIds: [],
  createdBy: null,
  dateCreated: '2026-06-01T09:00:00.000Z',
  dateUpdated: '2026-08-20T14:30:00.000Z',
  lastTriggered: '2026-08-30T02:15:00.000Z',
  owner: STORY_TEAM_OWNER,
  projectId: STORY_PROJECT.id,
  enabled: true,
  latestGroup: null,
  description: null,
};

export const STORY_ERROR_DETECTOR: ErrorDetector = {
  ...BASE_DETECTOR,
  id: 'story-error-detector',
  name: 'Storefront Errors',
  type: 'error',
};

export const STORY_METRIC_DETECTOR: MetricDetector = {
  ...BASE_DETECTOR,
  id: 'story-metric-detector',
  name: 'Checkout API Error Rate',
  type: 'metric_issue',
  config: {detectionType: 'static'},
  alertRuleId: null,
  conditionGroup: {
    id: 'story-metric-condition-group',
    logicType: DataConditionGroupLogicType.ANY,
    conditions: [
      {
        id: 'story-metric-condition-high',
        type: DataConditionType.GREATER,
        comparison: 50,
        conditionResult: DetectorPriorityLevel.HIGH,
      },
      {
        id: 'story-metric-condition-ok',
        type: DataConditionType.LESS_OR_EQUAL,
        comparison: 10,
        conditionResult: DetectorPriorityLevel.OK,
      },
    ],
  },
  dataSources: [
    {
      id: 'story-metric-data-source',
      organizationId: '1',
      sourceId: 'story-metric-subscription',
      type: 'snuba_query_subscription',
      queryObj: {
        id: 'story-metric-query',
        status: 1,
        subscription: 'story-metric-subscription',
        snubaQuery: {
          id: 'story-metric-snuba-query',
          aggregate: 'count()',
          dataset: Dataset.ERRORS,
          eventTypes: [EventTypes.ERROR],
          query: 'is:unresolved transaction:/api/checkout',
          timeWindow: 300,
        },
      },
    },
  ],
};

export const STORY_CRON_DETECTOR: CronDetector = {
  ...BASE_DETECTOR,
  id: 'story-cron-detector',
  name: 'Nightly Inventory Sync',
  type: 'monitor_check_in_failure',
  dataSources: [
    {
      id: 'story-cron-data-source',
      organizationId: '1',
      sourceId: 'story-cron-monitor',
      type: 'cron_monitor',
      queryObj: {
        id: 'story-cron-monitor',
        name: 'Nightly Inventory Sync',
        slug: 'nightly-inventory-sync',
        dateCreated: '2026-05-12T00:00:00.000Z',
        owner: STORY_TEAM_OWNER,
        project: STORY_PROJECT,
        isMuted: false,
        isUpserting: false,
        status: 'active',
        config: {
          checkin_margin: 5,
          failure_issue_threshold: 2,
          recovery_threshold: 1,
          max_runtime: 60,
          timezone: 'Etc/UTC',
          schedule: '0 2 * * *',
          schedule_type: ScheduleType.CRONTAB,
        },
        environments: [
          {
            name: 'production',
            dateCreated: '2026-05-12T00:00:00.000Z',
            isMuted: false,
            status: MonitorStatus.OK,
            lastCheckIn: '2026-08-31T02:00:12.000Z',
            nextCheckIn: '2026-09-01T02:00:00.000Z',
            nextCheckInLatest: '2026-09-01T02:05:00.000Z',
            activeIncident: null,
          },
        ],
      },
    },
  ],
};

export const STORY_UPTIME_DETECTOR: UptimeDetector = {
  ...BASE_DETECTOR,
  id: 'story-uptime-detector',
  name: 'Marketing Site Availability',
  type: 'uptime_domain_failure',
  config: {
    downtimeThreshold: 3,
    environment: 'production',
    mode: UptimeMonitorMode.MANUAL,
    recoveryThreshold: 2,
  },
  dataSources: [
    {
      id: 'story-uptime-data-source',
      organizationId: '1',
      sourceId: 'story-uptime-subscription',
      type: 'uptime_subscription',
      queryObj: {
        assertion: null,
        body: null,
        headers: [],
        intervalSeconds: 300,
        method: 'GET',
        timeoutMs: 10000,
        traceSampling: false,
        url: 'https://example.com/health',
      },
    },
  ],
};

export const STORY_MOBILE_BUILD_DETECTOR: PreprodDetector = {
  ...BASE_DETECTOR,
  id: 'story-mobile-build-detector',
  name: 'iOS Install Size Guardrail',
  type: 'preprod_size_analysis',
  config: {
    measurement: 'install_size',
    thresholdType: 'absolute',
  },
  conditionGroup: {
    id: 'story-mobile-condition-group',
    logicType: DataConditionGroupLogicType.ANY,
    conditions: [
      {
        id: 'story-mobile-condition-high',
        type: DataConditionType.GREATER,
        // 50 MB
        comparison: 52_428_800,
        conditionResult: DetectorPriorityLevel.HIGH,
      },
      {
        id: 'story-mobile-condition-ok',
        type: DataConditionType.LESS_OR_EQUAL,
        // 20 MB
        comparison: 20_971_520,
        conditionResult: DetectorPriorityLevel.OK,
      },
    ],
  },
};

export const STORY_MONITOR_DETECTORS = [
  STORY_ERROR_DETECTOR,
  STORY_METRIC_DETECTOR,
  STORY_CRON_DETECTOR,
  STORY_UPTIME_DETECTOR,
  STORY_MOBILE_BUILD_DETECTOR,
];
