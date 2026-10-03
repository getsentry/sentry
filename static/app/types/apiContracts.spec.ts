import {expectTypeOf} from 'expect-type';

import type {Group, Tag} from 'sentry/types/group';
import type {OrganizationIntegration, Repository} from 'sentry/types/integrations';
import type {
  DetailedTeam,
  Member,
  Organization,
  OrganizationSummary,
  Team,
} from 'sentry/types/organization';
import type {
  DetailedProject,
  Environment,
  Project,
  ProjectKey,
} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {ContractResponse} from 'sentry/utils/api/apiOptions';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import type {Monitor} from 'sentry/views/insights/crons/types';

/**
 * The response type the backend declares for `GET <route>`.
 */
type Get<TRoute extends string> = ContractResponse<TRoute>;

/**
 * The element type of a list response.
 */
type Item<T> = T extends Array<infer TItem> ? TItem : T;

/**
 * The keys of `TFrontend` that `TBackend` does not satisfy: required on the
 * frontend but absent from the backend contract, or declared with an
 * incompatible type. Each key maps to the two sides' types (or a note that the
 * backend contract lacks the key), so hovering a `Drift<...>` alias shows the
 * exact disagreement.
 */
type Drift<TBackend, TFrontend> = {
  [
    K in keyof TFrontend as K extends keyof TBackend
      ? TBackend[K] extends TFrontend[K]
        ? never
        : K
      : undefined extends TFrontend[K]
        ? never
        : K
  ]: K extends keyof TBackend
    ? {backend: TBackend[K]; frontend: TFrontend[K]}
    : 'missing from the backend contract';
};

type OrganizationList = Drift<Item<Get<'/organizations/'>>, OrganizationSummary>;
type OrganizationDetails = Drift<
  Get<'/organizations/$organizationIdOrSlug/'>,
  Organization
>;
type OrganizationProjects = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/projects/'>>,
  Project
>;
type OrganizationTeams = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/teams/'>>,
  Team
>;
type OrganizationMembers = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/members/'>>,
  Member
>;
type OrganizationMemberDetails = Drift<
  Get<'/organizations/$organizationIdOrSlug/members/$memberId/'>,
  Member
>;
type OrganizationReleases = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/releases/'>>,
  Release
>;
type OrganizationEnvironments = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/environments/'>>,
  Environment
>;
type OrganizationRepositories = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/repos/'>>,
  Repository
>;
type OrganizationIntegrations = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/integrations/'>>,
  OrganizationIntegration
>;
type OrganizationDashboards = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/dashboards/'>>,
  DashboardListItem
>;
type OrganizationIssues = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/issues/'>>,
  Group
>;
type IssueDetails = Drift<
  Get<'/organizations/$organizationIdOrSlug/issues/$issueId/'>,
  Group
>;
type OrganizationMonitors = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/monitors/'>>,
  Monitor
>;
type OrganizationTags = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/tags/'>>,
  Tag
>;
type OrganizationDetectors = Drift<
  Item<Get<'/organizations/$organizationIdOrSlug/detectors/'>>,
  Detector
>;
type ProjectDetails = Drift<
  Get<'/projects/$organizationIdOrSlug/$projectIdOrSlug/'>,
  DetailedProject
>;
type ProjectKeys = Drift<
  Item<Get<'/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/'>>,
  ProjectKey
>;
type ProjectEnvironments = Drift<
  Item<Get<'/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/'>>,
  Environment
>;
type ProjectTeams = Drift<
  Item<Get<'/projects/$organizationIdOrSlug/$projectIdOrSlug/teams/'>>,
  Team
>;
type TeamDetails = Drift<
  Get<'/teams/$organizationIdOrSlug/$teamIdOrSlug/'>,
  DetailedTeam
>;
type TeamProjects = Drift<
  Item<Get<'/teams/$organizationIdOrSlug/$teamIdOrSlug/projects/'>>,
  Project
>;

/**
 * Backend response contracts should be assignable to the hand-written frontend
 * types that consume them. Each assertion pins the keys that drift today, so
 * both a new disagreement and a fix change the expected union and fail
 * typecheck until the list is updated. The goal is `never` everywhere.
 *
 * A drifting key means one of: the backend TypedDict lacks a field the
 * serializer really sends (add it on the backend), the backend declares a
 * looser type than the frontend relies on (`str` where the frontend expects a
 * literal union, `dict[str, Any]` where it expects a shape), or the frontend
 * type claims something the API never returns (fix the frontend type). Hover
 * the `Drift<...>` alias for the two sides of each key.
 */
describe('API contracts', () => {
  it('organization endpoints', () => {
    expectTypeOf<keyof OrganizationList>().toEqualTypeOf<
      | 'avatar'
      | 'hideAiFeatures'
      | 'issueAlertsThreadFlag'
      | 'metricAlertsThreadFlag'
      | 'status'
    >();
    expectTypeOf<keyof OrganizationDetails>().toEqualTypeOf<
      | 'access'
      | 'aggregatedDataConsent'
      | 'alertsMemberWrite'
      | 'allowJoinRequests'
      | 'allowSharedIssues'
      | 'attachmentsRole'
      | 'autoEnableCodeReview'
      | 'autoOpenPrs'
      | 'availableRoles'
      | 'avatar'
      | 'dataScrubber'
      | 'dataScrubberDefaults'
      | 'debugFilesRole'
      | 'defaultAutomatedRunStoppingPoint'
      | 'defaultCodeReviewTriggers'
      | 'defaultCodingAgent'
      | 'defaultCodingAgentIntegrationId'
      | 'defaultRole'
      | 'enhancedPrivacy'
      | 'eventsMemberAdmin'
      | 'extraOptions'
      | 'features'
      | 'hasGranularReplayPermissions'
      | 'hideAiFeatures'
      | 'isDefault'
      | 'isDynamicallySampled'
      | 'issueAlertsThreadFlag'
      | 'metricAlertsThreadFlag'
      | 'onboardingTasks'
      | 'openMembership'
      | 'orgRoleList'
      | 'pendingAccessRequests'
      | 'quota'
      | 'relayPiiConfig'
      | 'replayAccessMembers'
      | 'requiresSso'
      | 'safeFields'
      | 'samplingMode'
      | 'scrapeJavaScript'
      | 'scrubIPAddresses'
      | 'sensitiveFields'
      | 'status'
      | 'storeCrashReports'
      | 'streamlineOnly'
      | 'targetSampleRate'
      | 'teamRoleList'
    >();
    expectTypeOf<keyof OrganizationProjects>().toEqualTypeOf<
      | 'access'
      | 'latestDeploys'
      | 'platform'
      | 'platforms'
      | 'sessionStats'
      | 'stats'
      | 'team'
      | 'teams'
      | 'transactionStats'
    >();
    expectTypeOf<keyof OrganizationTeams>().toEqualTypeOf<
      'access' | 'avatar' | 'externalTeams' | 'flags'
    >();
    expectTypeOf<keyof OrganizationMembers>().toEqualTypeOf<
      | 'inviteStatus'
      | 'invite_link'
      | 'isOnlyOwner'
      | 'orgRoleList'
      | 'projects'
      | 'role'
      | 'roleName'
      | 'roles'
      | 'teamRoleList'
      | 'teamRoles'
      | 'teams'
      | 'user'
    >();
    expectTypeOf<keyof OrganizationMemberDetails>().toEqualTypeOf<
      | 'inviteStatus'
      | 'projects'
      | 'role'
      | 'roleName'
      | 'roles'
      | 'teamRoleList'
      | 'user'
    >();
    expectTypeOf<keyof OrganizationReleases>().toEqualTypeOf<
      | 'adoptionStages'
      | 'authors'
      | 'currentProjectMeta'
      | 'dateCreated'
      | 'dateReleased'
      | 'fileCount'
      | 'firstEvent'
      | 'id'
      | 'lastCommit'
      | 'lastDeploy'
      | 'lastEvent'
      | 'projects'
      | 'ref'
      | 'status'
      | 'url'
      | 'userAgent'
      | 'versionInfo'
    >();
    expectTypeOf<keyof OrganizationEnvironments>().toEqualTypeOf<'displayName'>();
    expectTypeOf<keyof OrganizationRepositories>().toEqualTypeOf<
      'externalId' | 'externalSlug' | 'integrationId' | 'provider' | 'status' | 'url'
    >();
    expectTypeOf<keyof OrganizationIntegrations>().toEqualTypeOf<
      | 'configData'
      | 'configOrganization'
      | 'organizationIntegrationStatus'
      | 'provider'
      | 'status'
    >();
    expectTypeOf<keyof OrganizationDashboards>().toEqualTypeOf<
      | 'createdBy'
      | 'filters'
      | 'lastVisited'
      | 'permissions'
      | 'prebuiltId'
      | 'widgetDisplay'
      | 'widgetPreview'
    >();
    expectTypeOf<keyof OrganizationIssues>().toEqualTypeOf<
      | 'activity'
      | 'culprit'
      | 'derivedData'
      | 'filtered'
      | 'firstSeen'
      | 'integrationIssues'
      | 'issueCategory'
      | 'issueType'
      | 'lastSeen'
      | 'level'
      | 'lifetime'
      | 'owners'
      | 'participants'
      | 'platform'
      | 'priority'
      | 'project'
      | 'seenBy'
      | 'sentryAppIssues'
      | 'sessionCount'
      | 'shareId'
      | 'stats'
      | 'status'
      | 'substatus'
      | 'type'
      | 'userReportCount'
    >();
    expectTypeOf<keyof IssueDetails>().toEqualTypeOf<
      | 'activity'
      | 'count'
      | 'culprit'
      | 'derivedData'
      | 'filtered'
      | 'firstSeen'
      | 'integrationIssues'
      | 'issueCategory'
      | 'issueType'
      | 'lastSeen'
      | 'level'
      | 'owners'
      | 'participants'
      | 'platform'
      | 'priority'
      | 'project'
      | 'seenBy'
      | 'shareId'
      | 'stats'
      | 'status'
      | 'substatus'
      | 'type'
      | 'userCount'
    >();
    expectTypeOf<keyof OrganizationMonitors>().toEqualTypeOf<
      'alertRule' | 'config' | 'environments' | 'project' | 'status'
    >();
    expectTypeOf<keyof OrganizationTags>().toEqualTypeOf<
      'totalValues' | 'uniqueValues'
    >();
    expectTypeOf<keyof OrganizationDetectors>().toEqualTypeOf<
      | 'createdBy'
      | 'description'
      | 'lastTriggered'
      | 'latestGroup'
      | 'owner'
      | 'projectId'
      | 'type'
      | 'workflowIds'
    >();
  });

  it('project endpoints', () => {
    expectTypeOf<keyof ProjectDetails>().toEqualTypeOf<
      | 'access'
      | 'autofixAutomationTuning'
      | 'defaultEnvironment'
      | 'dynamicSamplingBiases'
      | 'environments'
      | 'highlightContext'
      | 'options'
      | 'platform'
      | 'platforms'
      | 'relayPiiConfig'
      | 'securityTokenHeader'
      | 'sessionStats'
      | 'stats'
      | 'team'
      | 'teams'
      | 'transactionStats'
    >();
    expectTypeOf<keyof ProjectKeys>().toEqualTypeOf<
      'browserSdk' | 'dateCreated' | 'public' | 'secret'
    >();
    expectTypeOf<keyof ProjectEnvironments>().toEqualTypeOf<'displayName'>();
    expectTypeOf<keyof ProjectTeams>().toEqualTypeOf<
      'access' | 'avatar' | 'externalTeams' | 'flags'
    >();
  });

  it('team endpoints', () => {
    expectTypeOf<keyof TeamDetails>().toEqualTypeOf<
      'access' | 'avatar' | 'externalTeams' | 'flags' | 'projects'
    >();
    expectTypeOf<keyof TeamProjects>().toEqualTypeOf<
      | 'access'
      | 'latestDeploys'
      | 'platform'
      | 'platforms'
      | 'sessionStats'
      | 'stats'
      | 'team'
      | 'teams'
      | 'transactionStats'
    >();
  });
});
