# HACK(jferge): this below is a temporary solution to not having to add the private attribute
# to all endpoints at once. if you are trying to exclude your endpoint from the OpenAPI JSON
# please set private = True on your endpoint, and don't modify this file

# TODO: add the attributes to endpoints in matches, eventually delete this file.

from sentry.api.endpoints.accept_organization_invite import AcceptOrganizationInvite
from sentry.api.endpoints.accept_project_transfer import AcceptProjectTransferEndpoint
from sentry.api.endpoints.api_application_details import ApiApplicationDetailsEndpoint
from sentry.api.endpoints.api_applications import ApiApplicationsEndpoint
from sentry.api.endpoints.api_authorizations import ApiAuthorizationsEndpoint
from sentry.api.endpoints.api_tokens import ApiTokensEndpoint
from sentry.api.endpoints.assistant import AssistantEndpoint
from sentry.api.endpoints.auth_config import AuthConfigEndpoint
from sentry.api.endpoints.auth_index import AuthIndexEndpoint
from sentry.api.endpoints.auth_login import AuthLoginEndpoint
from sentry.api.endpoints.authenticator_index import AuthenticatorIndexEndpoint
from sentry.api.endpoints.avatar import (
    DocIntegrationAvatarEndpoint,
    OrganizationAvatarEndpoint,
    ProjectAvatarEndpoint,
    SentryAppAvatarEndpoint,
    TeamAvatarEndpoint,
    UserAvatarEndpoint,
)
from sentry.api.endpoints.broadcast_details import BroadcastDetailsEndpoint
from sentry.api.endpoints.broadcast_index import BroadcastIndexEndpoint
from sentry.api.endpoints.builtin_symbol_sources import BuiltinSymbolSourcesEndpoint
from sentry.api.endpoints.chunk import ChunkUploadEndpoint
from sentry.api.endpoints.codeowners import (
    ExternalTeamDetailsEndpoint,
    ExternalTeamEndpoint,
    ExternalUserDetailsEndpoint,
    ExternalUserEndpoint,
    ProjectCodeOwnersDetailsEndpoint,
    ProjectCodeOwnersEndpoint,
)
from sentry.api.endpoints.data_scrubbing_selector_suggestions import (
    DataScrubbingSelectorSuggestionsEndpoint,
)
from sentry.api.endpoints.debug_files import (
    AssociateDSymFilesEndpoint,
    DebugFilesEndpoint,
    DifAssembleEndpoint,
    SourceMapsEndpoint,
    UnknownDebugFilesEndpoint,
)
from sentry.api.endpoints.event_apple_crash_report import EventAppleCrashReportEndpoint
from sentry.api.endpoints.event_attachment_details import EventAttachmentDetailsEndpoint
from sentry.api.endpoints.event_attachments import EventAttachmentsEndpoint
from sentry.api.endpoints.event_file_committers import EventFileCommittersEndpoint
from sentry.api.endpoints.event_grouping_info import EventGroupingInfoEndpoint
from sentry.api.endpoints.event_owners import EventOwnersEndpoint
from sentry.api.endpoints.event_reprocessable import EventReprocessableEndpoint
from sentry.api.endpoints.filechange import CommitFileChangeEndpoint
from sentry.api.endpoints.group_activities import GroupActivitiesEndpoint
from sentry.api.endpoints.group_attachments import GroupAttachmentsEndpoint
from sentry.api.endpoints.group_current_release import GroupCurrentReleaseEndpoint
from sentry.api.endpoints.group_details import GroupDetailsEndpoint
from sentry.api.endpoints.group_events import GroupEventsEndpoint
from sentry.api.endpoints.group_events_latest import GroupEventsLatestEndpoint
from sentry.api.endpoints.group_events_oldest import GroupEventsOldestEndpoint
from sentry.api.endpoints.group_external_issue_details import GroupExternalIssueDetailsEndpoint
from sentry.api.endpoints.group_external_issues import GroupExternalIssuesEndpoint
from sentry.api.endpoints.group_first_last_release import GroupFirstLastReleaseEndpoint
from sentry.api.endpoints.group_hashes import GroupHashesEndpoint
from sentry.api.endpoints.group_hashes_split import GroupHashesSplitEndpoint
from sentry.api.endpoints.group_integration_details import GroupIntegrationDetailsEndpoint
from sentry.api.endpoints.group_integrations import GroupIntegrationsEndpoint
from sentry.api.endpoints.group_notes import GroupNotesEndpoint
from sentry.api.endpoints.group_notes_details import GroupNotesDetailsEndpoint
from sentry.api.endpoints.group_participants import GroupParticipantsEndpoint
from sentry.api.endpoints.group_reprocessing import GroupReprocessingEndpoint
from sentry.api.endpoints.group_similar_issues import GroupSimilarIssuesEndpoint
from sentry.api.endpoints.group_stats import GroupStatsEndpoint
from sentry.api.endpoints.group_tagkey_details import GroupTagKeyDetailsEndpoint
from sentry.api.endpoints.group_tagkey_values import GroupTagKeyValuesEndpoint
from sentry.api.endpoints.group_tags import GroupTagsEndpoint
from sentry.api.endpoints.group_tombstone import GroupTombstoneEndpoint
from sentry.api.endpoints.group_tombstone_details import GroupTombstoneDetailsEndpoint
from sentry.api.endpoints.group_user_reports import GroupUserReportsEndpoint
from sentry.api.endpoints.grouping_configs import GroupingConfigsEndpoint
from sentry.api.endpoints.grouping_level_new_issues import GroupingLevelNewIssuesEndpoint
from sentry.api.endpoints.grouping_levels import GroupingLevelsEndpoint
from sentry.api.endpoints.index import IndexEndpoint
from sentry.api.endpoints.integration_features import IntegrationFeaturesEndpoint
from sentry.api.endpoints.integrations import (
    DocIntegrationDetailsEndpoint,
    DocIntegrationsEndpoint,
    OrganizationConfigIntegrationsEndpoint,
    OrganizationIntegrationDetailsEndpoint,
    OrganizationIntegrationRequestEndpoint,
    OrganizationIntegrationsEndpoint,
    OrganizationPluginsConfigsEndpoint,
    OrganizationPluginsEndpoint,
)
from sentry.api.endpoints.integrations.sentry_apps import (
    OrganizationSentryAppComponentsEndpoint,
    OrganizationSentryAppsEndpoint,
    SentryAppAuthorizationsEndpoint,
    SentryAppComponentsEndpoint,
    SentryAppDetailsEndpoint,
    SentryAppFeaturesEndpoint,
    SentryAppInstallationDetailsEndpoint,
    SentryAppInstallationExternalIssueActionsEndpoint,
    SentryAppInstallationExternalIssueDetailsEndpoint,
    SentryAppInstallationExternalIssuesEndpoint,
    SentryAppInstallationExternalRequestsEndpoint,
    SentryAppInstallationsEndpoint,
    SentryAppInteractionEndpoint,
    SentryAppPublishRequestEndpoint,
    SentryAppRequestsEndpoint,
    SentryAppsEndpoint,
    SentryAppsStatsEndpoint,
    SentryAppStatsEndpoint,
    SentryInternalAppTokenDetailsEndpoint,
    SentryInternalAppTokensEndpoint,
)
from sentry.api.endpoints.internal import (
    InternalBeaconEndpoint,
    InternalEnvironmentEndpoint,
    InternalMailEndpoint,
    InternalPackagesEndpoint,
    InternalQueueTasksEndpoint,
    InternalQuotasEndpoint,
    InternalStatsEndpoint,
    InternalWarningsEndpoint,
)
from sentry.api.endpoints.monitor_checkin_details import MonitorCheckInDetailsEndpoint
from sentry.api.endpoints.monitor_checkins import MonitorCheckInsEndpoint
from sentry.api.endpoints.monitor_details import MonitorDetailsEndpoint
from sentry.api.endpoints.monitor_stats import MonitorStatsEndpoint
from sentry.api.endpoints.organization_access_request_details import (
    OrganizationAccessRequestDetailsEndpoint,
)
from sentry.api.endpoints.organization_activity import OrganizationActivityEndpoint
from sentry.api.endpoints.organization_api_key_details import OrganizationApiKeyDetailsEndpoint
from sentry.api.endpoints.organization_api_key_index import OrganizationApiKeyIndexEndpoint
from sentry.api.endpoints.organization_auditlogs import OrganizationAuditLogsEndpoint
from sentry.api.endpoints.organization_auth_provider_details import (
    OrganizationAuthProviderDetailsEndpoint,
)
from sentry.api.endpoints.organization_auth_provider_send_reminders import (
    OrganizationAuthProviderSendRemindersEndpoint,
)
from sentry.api.endpoints.organization_auth_providers import OrganizationAuthProvidersEndpoint
from sentry.api.endpoints.organization_code_mapping_codeowners import (
    OrganizationCodeMappingCodeOwnersEndpoint,
)
from sentry.api.endpoints.organization_code_mapping_details import (
    OrganizationCodeMappingDetailsEndpoint,
)
from sentry.api.endpoints.organization_code_mappings import OrganizationCodeMappingsEndpoint
from sentry.api.endpoints.organization_codeowners_associations import (
    OrganizationCodeOwnersAssociationsEndpoint,
)
from sentry.api.endpoints.organization_config_repositories import (
    OrganizationConfigRepositoriesEndpoint,
)
from sentry.api.endpoints.organization_dashboard_details import (
    OrganizationDashboardDetailsEndpoint,
    OrganizationDashboardVisitEndpoint,
)
from sentry.api.endpoints.organization_dashboard_widget_details import (
    OrganizationDashboardWidgetDetailsEndpoint,
)
from sentry.api.endpoints.organization_dashboards import OrganizationDashboardsEndpoint
from sentry.api.endpoints.organization_details import OrganizationDetailsEndpoint
from sentry.api.endpoints.organization_environments import OrganizationEnvironmentsEndpoint
from sentry.api.endpoints.organization_event_details import OrganizationEventDetailsEndpoint
from sentry.api.endpoints.organization_eventid import EventIdLookupEndpoint
from sentry.api.endpoints.organization_events import OrganizationEventsGeoEndpoint
from sentry.api.endpoints.organization_events_facets import OrganizationEventsFacetsEndpoint
from sentry.api.endpoints.organization_events_facets_performance import (
    OrganizationEventsFacetsPerformanceEndpoint,
    OrganizationEventsFacetsPerformanceHistogramEndpoint,
)
from sentry.api.endpoints.organization_events_has_measurements import (
    OrganizationEventsHasMeasurementsEndpoint,
)
from sentry.api.endpoints.organization_events_histogram import OrganizationEventsHistogramEndpoint
from sentry.api.endpoints.organization_events_meta import (
    OrganizationEventsMetaEndpoint,
    OrganizationEventsRelatedIssuesEndpoint,
)
from sentry.api.endpoints.organization_events_span_ops import OrganizationEventsSpanOpsEndpoint
from sentry.api.endpoints.organization_events_spans_performance import (
    OrganizationEventsSpansExamplesEndpoint,
    OrganizationEventsSpansPerformanceEndpoint,
    OrganizationEventsSpansStatsEndpoint,
)
from sentry.api.endpoints.organization_events_stats import OrganizationEventsStatsEndpoint
from sentry.api.endpoints.organization_events_trace import (
    OrganizationEventsTraceEndpoint,
    OrganizationEventsTraceLightEndpoint,
    OrganizationEventsTraceMetaEndpoint,
)
from sentry.api.endpoints.organization_events_trends import (
    OrganizationEventsTrendsEndpoint,
    OrganizationEventsTrendsStatsEndpoint,
)
from sentry.api.endpoints.organization_events_vitals import OrganizationEventsVitalsEndpoint
from sentry.api.endpoints.organization_group_index import OrganizationGroupIndexEndpoint
from sentry.api.endpoints.organization_group_index_stats import OrganizationGroupIndexStatsEndpoint
from sentry.api.endpoints.organization_index import OrganizationIndexEndpoint
from sentry.api.endpoints.organization_integration_repos import OrganizationIntegrationReposEndpoint
from sentry.api.endpoints.organization_integration_serverless_functions import (
    OrganizationIntegrationServerlessFunctionsEndpoint,
)
from sentry.api.endpoints.organization_issues_count import OrganizationIssuesCountEndpoint
from sentry.api.endpoints.organization_issues_resolved_in_release import (
    OrganizationIssuesResolvedInReleaseEndpoint,
)
from sentry.api.endpoints.organization_member import (
    OrganizationInviteRequestDetailsEndpoint,
    OrganizationInviteRequestIndexEndpoint,
    OrganizationJoinRequestEndpoint,
    OrganizationMemberDetailsEndpoint,
    OrganizationMemberIndexEndpoint,
)
from sentry.api.endpoints.organization_member.team_details import (
    OrganizationMemberTeamDetailsEndpoint,
)
from sentry.api.endpoints.organization_member_unreleased_commits import (
    OrganizationMemberUnreleasedCommitsEndpoint,
)
from sentry.api.endpoints.organization_metrics import (
    OrganizationMetricDetailsEndpoint,
    OrganizationMetricsDataEndpoint,
    OrganizationMetricsEndpoint,
    OrganizationMetricsTagDetailsEndpoint,
    OrganizationMetricsTagsEndpoint,
)
from sentry.api.endpoints.organization_monitors import OrganizationMonitorsEndpoint
from sentry.api.endpoints.organization_onboarding_tasks import OrganizationOnboardingTaskEndpoint
from sentry.api.endpoints.organization_pinned_searches import OrganizationPinnedSearchEndpoint
from sentry.api.endpoints.organization_processingissues import OrganizationProcessingIssuesEndpoint
from sentry.api.endpoints.organization_profiling_profiles import (
    OrganizationProfilingFiltersEndpoint,
    OrganizationProfilingProfilesEndpoint,
)
from sentry.api.endpoints.organization_projects import (
    OrganizationProjectsCountEndpoint,
    OrganizationProjectsEndpoint,
)
from sentry.api.endpoints.organization_projects_sent_first_event import (
    OrganizationProjectsSentFirstEventEndpoint,
)
from sentry.api.endpoints.organization_recent_searches import OrganizationRecentSearchesEndpoint
from sentry.api.endpoints.organization_relay_usage import OrganizationRelayUsage
from sentry.api.endpoints.organization_release_assemble import OrganizationReleaseAssembleEndpoint
from sentry.api.endpoints.organization_release_commits import OrganizationReleaseCommitsEndpoint
from sentry.api.endpoints.organization_release_details import OrganizationReleaseDetailsEndpoint
from sentry.api.endpoints.organization_release_file_details import (
    OrganizationReleaseFileDetailsEndpoint,
)
from sentry.api.endpoints.organization_release_files import OrganizationReleaseFilesEndpoint
from sentry.api.endpoints.organization_release_meta import OrganizationReleaseMetaEndpoint
from sentry.api.endpoints.organization_release_previous_commits import (
    OrganizationReleasePreviousCommitsEndpoint,
)
from sentry.api.endpoints.organization_releases import (
    OrganizationReleasesEndpoint,
    OrganizationReleasesStatsEndpoint,
)
from sentry.api.endpoints.organization_repositories import OrganizationRepositoriesEndpoint
from sentry.api.endpoints.organization_repository_commits import (
    OrganizationRepositoryCommitsEndpoint,
)
from sentry.api.endpoints.organization_repository_details import (
    OrganizationRepositoryDetailsEndpoint,
)
from sentry.api.endpoints.organization_request_project_creation import (
    OrganizationRequestProjectCreation,
)
from sentry.api.endpoints.organization_sdk_updates import OrganizationSdkUpdatesEndpoint
from sentry.api.endpoints.organization_search_details import OrganizationSearchDetailsEndpoint
from sentry.api.endpoints.organization_searches import OrganizationSearchesEndpoint
from sentry.api.endpoints.organization_sessions import OrganizationSessionsEndpoint
from sentry.api.endpoints.organization_shortid import ShortIdLookupEndpoint
from sentry.api.endpoints.organization_slugs import SlugsUpdateEndpoint
from sentry.api.endpoints.organization_stats import OrganizationStatsEndpoint
from sentry.api.endpoints.organization_stats_v2 import OrganizationStatsEndpointV2
from sentry.api.endpoints.organization_tagkey_values import OrganizationTagKeyValuesEndpoint
from sentry.api.endpoints.organization_tags import OrganizationTagsEndpoint
from sentry.api.endpoints.organization_teams import OrganizationTeamsEndpoint
from sentry.api.endpoints.organization_transaction_anomaly_detection import (
    OrganizationTransactionAnomalyDetectionEndpoint,
)
from sentry.api.endpoints.organization_user_details import OrganizationUserDetailsEndpoint
from sentry.api.endpoints.organization_user_issues_search import (
    OrganizationUserIssuesSearchEndpoint,
)
from sentry.api.endpoints.organization_user_reports import OrganizationUserReportsEndpoint
from sentry.api.endpoints.organization_user_teams import OrganizationUserTeamsEndpoint
from sentry.api.endpoints.organization_users import OrganizationUsersEndpoint
from sentry.api.endpoints.project_agnostic_rule_conditions import (
    ProjectAgnosticRuleConditionsEndpoint,
)
from sentry.api.endpoints.project_app_store_connect_credentials import (
    AppStoreConnectAppsEndpoint,
    AppStoreConnectCreateCredentialsEndpoint,
    AppStoreConnectStatusEndpoint,
    AppStoreConnectUpdateCredentialsEndpoint,
)
from sentry.api.endpoints.project_create_sample import ProjectCreateSampleEndpoint
from sentry.api.endpoints.project_create_sample_transaction import (
    ProjectCreateSampleTransactionEndpoint,
)
from sentry.api.endpoints.project_details import ProjectDetailsEndpoint
from sentry.api.endpoints.project_docs_platform import ProjectDocsPlatformEndpoint
from sentry.api.endpoints.project_environment_details import ProjectEnvironmentDetailsEndpoint
from sentry.api.endpoints.project_environments import ProjectEnvironmentsEndpoint
from sentry.api.endpoints.project_event_details import (
    EventJsonEndpoint,
    ProjectEventDetailsEndpoint,
)
from sentry.api.endpoints.project_events import ProjectEventsEndpoint
from sentry.api.endpoints.project_filter_details import ProjectFilterDetailsEndpoint
from sentry.api.endpoints.project_filters import ProjectFiltersEndpoint
from sentry.api.endpoints.project_group_index import ProjectGroupIndexEndpoint
from sentry.api.endpoints.project_group_stats import ProjectGroupStatsEndpoint
from sentry.api.endpoints.project_grouping_configs import ProjectGroupingConfigsEndpoint
from sentry.api.endpoints.project_index import ProjectIndexEndpoint
from sentry.api.endpoints.project_issues_resolved_in_release import (
    ProjectIssuesResolvedInReleaseEndpoint,
)
from sentry.api.endpoints.project_key_details import ProjectKeyDetailsEndpoint
from sentry.api.endpoints.project_key_stats import ProjectKeyStatsEndpoint
from sentry.api.endpoints.project_keys import ProjectKeysEndpoint
from sentry.api.endpoints.project_member_index import ProjectMemberIndexEndpoint
from sentry.api.endpoints.project_ownership import ProjectOwnershipEndpoint
from sentry.api.endpoints.project_platforms import ProjectPlatformsEndpoint
from sentry.api.endpoints.project_plugin_details import ProjectPluginDetailsEndpoint
from sentry.api.endpoints.project_plugins import ProjectPluginsEndpoint
from sentry.api.endpoints.project_processingissues import (
    ProjectProcessingIssuesDiscardEndpoint,
    ProjectProcessingIssuesEndpoint,
    ProjectProcessingIssuesFixEndpoint,
)
from sentry.api.endpoints.project_profiling_profile import (
    ProjectProfilingProfileEndpoint,
    ProjectProfilingRawProfileEndpoint,
)
from sentry.api.endpoints.project_release_commits import ProjectReleaseCommitsEndpoint
from sentry.api.endpoints.project_release_details import ProjectReleaseDetailsEndpoint
from sentry.api.endpoints.project_release_file_details import ProjectReleaseFileDetailsEndpoint
from sentry.api.endpoints.project_release_files import ProjectReleaseFilesEndpoint
from sentry.api.endpoints.project_release_repositories import ProjectReleaseRepositories
from sentry.api.endpoints.project_release_setup import ProjectReleaseSetupCompletionEndpoint
from sentry.api.endpoints.project_release_stats import ProjectReleaseStatsEndpoint
from sentry.api.endpoints.project_releases import ProjectReleasesEndpoint
from sentry.api.endpoints.project_releases_token import ProjectReleasesTokenEndpoint
from sentry.api.endpoints.project_repo_path_parsing import ProjectRepoPathParsingEndpoint
from sentry.api.endpoints.project_reprocessing import ProjectReprocessingEndpoint
from sentry.api.endpoints.project_rule_details import ProjectRuleDetailsEndpoint
from sentry.api.endpoints.project_rule_task_details import ProjectRuleTaskDetailsEndpoint
from sentry.api.endpoints.project_rules import ProjectRulesEndpoint
from sentry.api.endpoints.project_rules_configuration import ProjectRulesConfigurationEndpoint
from sentry.api.endpoints.project_servicehook_details import ProjectServiceHookDetailsEndpoint
from sentry.api.endpoints.project_servicehook_stats import ProjectServiceHookStatsEndpoint
from sentry.api.endpoints.project_servicehooks import ProjectServiceHooksEndpoint
from sentry.api.endpoints.project_stacktrace_link import ProjectStacktraceLinkEndpoint
from sentry.api.endpoints.project_stats import ProjectStatsEndpoint
from sentry.api.endpoints.project_tagkey_details import ProjectTagKeyDetailsEndpoint
from sentry.api.endpoints.project_tagkey_values import ProjectTagKeyValuesEndpoint
from sentry.api.endpoints.project_tags import ProjectTagsEndpoint
from sentry.api.endpoints.project_team_details import ProjectTeamDetailsEndpoint
from sentry.api.endpoints.project_teams import ProjectTeamsEndpoint
from sentry.api.endpoints.project_transaction_threshold import ProjectTransactionThresholdEndpoint
from sentry.api.endpoints.project_transaction_threshold_override import (
    ProjectTransactionThresholdOverrideEndpoint,
)
from sentry.api.endpoints.project_transfer import ProjectTransferEndpoint
from sentry.api.endpoints.project_user_details import ProjectUserDetailsEndpoint
from sentry.api.endpoints.project_user_reports import ProjectUserReportsEndpoint
from sentry.api.endpoints.project_user_stats import ProjectUserStatsEndpoint
from sentry.api.endpoints.project_users import ProjectUsersEndpoint
from sentry.api.endpoints.prompts_activity import PromptsActivityEndpoint
from sentry.api.endpoints.relay import (
    RelayDetailsEndpoint,
    RelayHealthCheck,
    RelayIdSerializer,
    RelayIndexEndpoint,
    RelayProjectConfigsEndpoint,
    RelayProjectIdsEndpoint,
    RelayPublicKeysEndpoint,
    RelayRegisterChallengeEndpoint,
    RelayRegisterResponseEndpoint,
)
from sentry.api.endpoints.release_deploys import ReleaseDeploysEndpoint
from sentry.api.endpoints.setup_wizard import SetupWizard
from sentry.api.endpoints.shared_group_details import SharedGroupDetailsEndpoint
from sentry.api.endpoints.system_health import SystemHealthEndpoint
from sentry.api.endpoints.system_options import SystemOptionsEndpoint
from sentry.api.endpoints.team_alerts_triggered import (
    TeamAlertsTriggeredIndexEndpoint,
    TeamAlertsTriggeredTotalsEndpoint,
)
from sentry.api.endpoints.team_all_unresolved_issues import TeamAllUnresolvedIssuesEndpoint
from sentry.api.endpoints.team_details import TeamDetailsEndpoint
from sentry.api.endpoints.team_groups_old import TeamGroupsOldEndpoint
from sentry.api.endpoints.team_issue_breakdown import TeamIssueBreakdownEndpoint
from sentry.api.endpoints.team_members import TeamMembersEndpoint
from sentry.api.endpoints.team_notification_settings_details import (
    TeamNotificationSettingsDetailsEndpoint,
)
from sentry.api.endpoints.team_projects import TeamProjectsEndpoint
from sentry.api.endpoints.team_release_count import TeamReleaseCountEndpoint
from sentry.api.endpoints.team_stats import TeamStatsEndpoint
from sentry.api.endpoints.team_time_to_resolution import TeamTimeToResolutionEndpoint
from sentry.api.endpoints.team_unresolved_issue_age import TeamUnresolvedIssueAgeEndpoint
from sentry.api.endpoints.user_authenticator_details import UserAuthenticatorDetailsEndpoint
from sentry.api.endpoints.user_authenticator_enroll import UserAuthenticatorEnrollEndpoint
from sentry.api.endpoints.user_authenticator_index import UserAuthenticatorIndexEndpoint
from sentry.api.endpoints.user_details import UserDetailsEndpoint
from sentry.api.endpoints.user_emails import UserEmailsEndpoint
from sentry.api.endpoints.user_emails_confirm import UserEmailsConfirmEndpoint
from sentry.api.endpoints.user_identity import UserIdentityEndpoint
from sentry.api.endpoints.user_identity_config import (
    UserIdentityConfigDetailsEndpoint,
    UserIdentityConfigEndpoint,
)
from sentry.api.endpoints.user_identity_details import UserIdentityDetailsEndpoint
from sentry.api.endpoints.user_index import UserIndexEndpoint
from sentry.api.endpoints.user_ips import UserIPsEndpoint
from sentry.api.endpoints.user_notification_details import UserNotificationDetailsEndpoint
from sentry.api.endpoints.user_notification_fine_tuning import UserNotificationFineTuningEndpoint
from sentry.api.endpoints.user_notification_settings_details import (
    UserNotificationSettingsDetailsEndpoint,
)
from sentry.api.endpoints.user_organizationintegrations import UserOrganizationIntegrationsEndpoint
from sentry.api.endpoints.user_organizations import UserOrganizationsEndpoint
from sentry.api.endpoints.user_password import UserPasswordEndpoint
from sentry.api.endpoints.user_permission_details import UserPermissionDetailsEndpoint
from sentry.api.endpoints.user_permissions import UserPermissionsEndpoint
from sentry.api.endpoints.user_permissions_config import UserPermissionsConfigEndpoint
from sentry.api.endpoints.user_role_details import UserUserRoleDetailsEndpoint
from sentry.api.endpoints.user_roles import UserUserRolesEndpoint
from sentry.api.endpoints.user_social_identities_index import UserSocialIdentitiesIndexEndpoint
from sentry.api.endpoints.user_social_identity_details import UserSocialIdentityDetailsEndpoint
from sentry.api.endpoints.user_subscriptions import UserSubscriptionsEndpoint
from sentry.api.endpoints.userroles_details import UserRoleDetailsEndpoint
from sentry.api.endpoints.userroles_index import UserRolesEndpoint
from sentry.data_export.endpoints.data_export import DataExportEndpoint
from sentry.data_export.endpoints.data_export_details import DataExportDetailsEndpoint
from sentry.discover.endpoints.discover_key_transactions import (
    KeyTransactionEndpoint,
    KeyTransactionListEndpoint,
)
from sentry.discover.endpoints.discover_saved_queries import DiscoverSavedQueriesEndpoint
from sentry.discover.endpoints.discover_saved_query_detail import (
    DiscoverSavedQueryDetailEndpoint,
    DiscoverSavedQueryVisitEndpoint,
)
from sentry.incidents.endpoints.organization_alert_rule_available_action_index import (
    OrganizationAlertRuleAvailableActionIndexEndpoint,
)
from sentry.incidents.endpoints.organization_alert_rule_details import (
    OrganizationAlertRuleDetailsEndpoint,
)
from sentry.incidents.endpoints.organization_alert_rule_index import (
    OrganizationAlertRuleIndexEndpoint,
    OrganizationCombinedRuleIndexEndpoint,
)
from sentry.incidents.endpoints.organization_incident_activity_index import (
    OrganizationIncidentActivityIndexEndpoint,
)
from sentry.incidents.endpoints.organization_incident_comment_details import (
    OrganizationIncidentCommentDetailsEndpoint,
)
from sentry.incidents.endpoints.organization_incident_comment_index import (
    OrganizationIncidentCommentIndexEndpoint,
)
from sentry.incidents.endpoints.organization_incident_details import (
    OrganizationIncidentDetailsEndpoint,
)
from sentry.incidents.endpoints.organization_incident_index import OrganizationIncidentIndexEndpoint
from sentry.incidents.endpoints.organization_incident_seen import OrganizationIncidentSeenEndpoint
from sentry.incidents.endpoints.organization_incident_subscription_index import (
    OrganizationIncidentSubscriptionIndexEndpoint,
)
from sentry.incidents.endpoints.project_alert_rule_details import ProjectAlertRuleDetailsEndpoint
from sentry.incidents.endpoints.project_alert_rule_index import (
    ProjectAlertRuleIndexEndpoint,
    ProjectCombinedRuleIndexEndpoint,
)
from sentry.incidents.endpoints.project_alert_rule_task_details import (
    ProjectAlertRuleTaskDetailsEndpoint,
)
from sentry.integrations.bitbucket.descriptor import BitbucketDescriptorEndpoint
from sentry.integrations.bitbucket.installed import BitbucketInstalledEndpoint
from sentry.integrations.bitbucket.search import BitbucketSearchEndpoint
from sentry.integrations.bitbucket.uninstalled import BitbucketUninstalledEndpoint
from sentry.integrations.cloudflare.metadata import CloudflareMetadataEndpoint
from sentry.integrations.cloudflare.webhook import CloudflareWebhookEndpoint
from sentry.integrations.github.search import GitHubSearchEndpoint
from sentry.integrations.gitlab.search import GitlabIssueSearchEndpoint
from sentry.integrations.jira.webhooks import JiraIssueUpdatedWebhook
from sentry.integrations.jira.webhooks.descriptor import JiraDescriptorEndpoint
from sentry.integrations.jira.webhooks.installed import JiraInstalledEndpoint
from sentry.integrations.jira.webhooks.search import JiraSearchEndpoint
from sentry.integrations.jira.webhooks.uninstalled import JiraUninstalledEndpoint
from sentry.integrations.jira_server.search import JiraServerSearchEndpoint
from sentry.integrations.jira_server.webhooks import (
    JiraIssueUpdatedWebhook as JiraServerIssueUpdatedWebhook,
)
from sentry.integrations.msteams.webhook import MsTeamsWebhookEndpoint
from sentry.integrations.slack.webhooks import (
    SlackActionEndpoint,
    SlackCommandsEndpoint,
    SlackEventEndpoint,
)
from sentry.integrations.vercel.webhook import VercelWebhookEndpoint
from sentry.integrations.vsts.search import VstsSearchEndpoint
from sentry.integrations.vsts.webhooks import WorkItemWebhook
from sentry.plugins.bases.issue2 import IssueGroupActionEndpoint
from sentry.plugins.endpoints import PluginGroupEndpoint
from sentry.rules.history.endpoints.project_rule_group_history import (
    ProjectRuleGroupHistoryIndexEndpoint,
)

__PUBLIC_ENDPOINTS_FROM_JSON = {
    OrganizationIndexEndpoint,
    OrganizationDetailsEndpoint,
    ShortIdLookupEndpoint,
    EventIdLookupEndpoint,
    GroupDetailsEndpoint,
    GroupEventsEndpoint,
    GroupEventsLatestEndpoint,
    GroupEventsOldestEndpoint,
    GroupHashesEndpoint,
    GroupTagKeyDetailsEndpoint,
    GroupTagKeyValuesEndpoint,
    OrganizationSessionsEndpoint,
    OrganizationMemberTeamDetailsEndpoint,
    OrganizationProjectsEndpoint,
    OrganizationRepositoriesEndpoint,
    OrganizationRepositoryCommitsEndpoint,
    OrganizationReleasesEndpoint,
    OrganizationReleaseDetailsEndpoint,
    OrganizationReleaseFilesEndpoint,
    OrganizationReleaseFileDetailsEndpoint,
    CommitFileChangeEndpoint,
    ReleaseDeploysEndpoint,
    OrganizationReleaseCommitsEndpoint,
    OrganizationUsersEndpoint,
    OrganizationStatsEndpoint,
    OrganizationStatsEndpointV2,
    OrganizationTeamsEndpoint,
    TeamDetailsEndpoint,
    TeamProjectsEndpoint,
    TeamStatsEndpoint,
    ExternalTeamDetailsEndpoint,
    ProjectIndexEndpoint,
    ProjectDetailsEndpoint,
    ProjectEventsEndpoint,
    ProjectEventDetailsEndpoint,
    DebugFilesEndpoint,
    UnknownDebugFilesEndpoint,
    ProjectServiceHooksEndpoint,
    ProjectServiceHookDetailsEndpoint,
    ProjectGroupIndexEndpoint,
    ProjectKeysEndpoint,
    ProjectKeyDetailsEndpoint,
    ProjectReleaseCommitsEndpoint,
    ProjectIssuesResolvedInReleaseEndpoint,
    ProjectReleaseFilesEndpoint,
    ProjectReleaseFileDetailsEndpoint,
    ProjectStatsEndpoint,
    ProjectTagKeyValuesEndpoint,
    ProjectTeamDetailsEndpoint,
    ProjectUsersEndpoint,
    ProjectUserReportsEndpoint,
    SharedGroupDetailsEndpoint,
}
__EXCLUDED_FROM_PUBLIC_ENDPOINTS = {
    OrganizationSentryAppComponentsEndpoint,
    SentryAppAuthorizationsEndpoint,
    SentryAppComponentsEndpoint,
    SentryAppDetailsEndpoint,
    SentryAppFeaturesEndpoint,
    SentryAppInstallationDetailsEndpoint,
    SentryAppInstallationExternalIssueActionsEndpoint,
    SentryAppInstallationExternalIssueDetailsEndpoint,
    SentryAppInstallationExternalIssuesEndpoint,
    SentryAppInstallationExternalRequestsEndpoint,
    SentryAppInstallationsEndpoint,
    SentryAppPublishRequestEndpoint,
    SentryAppRequestsEndpoint,
    SentryAppsEndpoint,
    SentryAppsStatsEndpoint,
    SentryAppStatsEndpoint,
    SentryInternalAppTokenDetailsEndpoint,
    SentryInternalAppTokensEndpoint,
    SentryAppInteractionEndpoint,
    OrganizationProfilingFiltersEndpoint,
    OrganizationTransactionAnomalyDetectionEndpoint,
    OrganizationProfilingProfilesEndpoint,
    ProjectProfilingProfileEndpoint,
    ProjectProfilingRawProfileEndpoint,
    JiraDescriptorEndpoint,
    JiraInstalledEndpoint,
    JiraUninstalledEndpoint,
    JiraSearchEndpoint,
    AssistantEndpoint,
    ApiApplicationsEndpoint,
    ApiApplicationDetailsEndpoint,
    ApiAuthorizationsEndpoint,
    ApiTokensEndpoint,
    PromptsActivityEndpoint,
    AuthIndexEndpoint,
    AuthConfigEndpoint,
    AuthLoginEndpoint,
    AuthenticatorIndexEndpoint,
    BroadcastIndexEndpoint,
    BroadcastDetailsEndpoint,
    AcceptProjectTransferEndpoint,
    AcceptOrganizationInvite,
    MonitorDetailsEndpoint,
    MonitorCheckInsEndpoint,
    MonitorCheckInDetailsEndpoint,
    MonitorStatsEndpoint,
    UserIndexEndpoint,
    UserDetailsEndpoint,
    UserAvatarEndpoint,
    UserAuthenticatorIndexEndpoint,
    UserAuthenticatorEnrollEndpoint,
    UserAuthenticatorDetailsEndpoint,
    UserEmailsEndpoint,
    UserEmailsConfirmEndpoint,
    UserIdentityDetailsEndpoint,
    UserIdentityEndpoint,
    UserIPsEndpoint,
    UserOrganizationsEndpoint,
    UserNotificationSettingsDetailsEndpoint,
    UserNotificationDetailsEndpoint,
    UserNotificationFineTuningEndpoint,
    UserPasswordEndpoint,
    UserPermissionsEndpoint,
    UserPermissionsConfigEndpoint,
    UserPermissionDetailsEndpoint,
    UserUserRolesEndpoint,
    UserUserRoleDetailsEndpoint,
    UserSocialIdentitiesIndexEndpoint,
    UserSocialIdentityDetailsEndpoint,
    UserSubscriptionsEndpoint,
    UserOrganizationIntegrationsEndpoint,
    UserIdentityConfigEndpoint,
    UserIdentityConfigDetailsEndpoint,
    UserRolesEndpoint,
    UserRoleDetailsEndpoint,
    OrganizationAlertRuleAvailableActionIndexEndpoint,
    OrganizationAlertRuleDetailsEndpoint,
    OrganizationAlertRuleIndexEndpoint,
    OrganizationCombinedRuleIndexEndpoint,
    DataExportEndpoint,
    DataExportDetailsEndpoint,
    OrganizationIncidentActivityIndexEndpoint,
    OrganizationIncidentCommentIndexEndpoint,
    OrganizationIncidentCommentDetailsEndpoint,
    OrganizationIncidentDetailsEndpoint,
    OrganizationIncidentIndexEndpoint,
    OrganizationIncidentSeenEndpoint,
    OrganizationIncidentSubscriptionIndexEndpoint,
    ChunkUploadEndpoint,
    OrganizationCodeMappingsEndpoint,
    OrganizationCodeMappingDetailsEndpoint,
    OrganizationCodeMappingCodeOwnersEndpoint,
    DiscoverSavedQueriesEndpoint,
    DiscoverSavedQueryDetailEndpoint,
    DiscoverSavedQueryVisitEndpoint,
    KeyTransactionEndpoint,
    SentryAppAvatarEndpoint,
    RelayDetailsEndpoint,
    RelayHealthCheck,
    RelayIdSerializer,
    RelayIndexEndpoint,
    RelayProjectConfigsEndpoint,
    RelayProjectIdsEndpoint,
    RelayPublicKeysEndpoint,
    RelayRegisterChallengeEndpoint,
    RelayRegisterResponseEndpoint,
    KeyTransactionListEndpoint,
    OrganizationEventsRelatedIssuesEndpoint,
    ProjectTransactionThresholdOverrideEndpoint,
    OrganizationDashboardsEndpoint,
    OrganizationDashboardWidgetDetailsEndpoint,
    OrganizationDashboardDetailsEndpoint,
    OrganizationDashboardVisitEndpoint,
    DataScrubbingSelectorSuggestionsEndpoint,
    SlugsUpdateEndpoint,
    OrganizationAccessRequestDetailsEndpoint,
    OrganizationActivityEndpoint,
    OrganizationApiKeyIndexEndpoint,
    OrganizationApiKeyDetailsEndpoint,
    OrganizationAuditLogsEndpoint,
    OrganizationAuthProviderDetailsEndpoint,
    OrganizationAuthProvidersEndpoint,
    OrganizationAuthProviderSendRemindersEndpoint,
    OrganizationAvatarEndpoint,
    OrganizationConfigIntegrationsEndpoint,
    OrganizationConfigRepositoriesEndpoint,
    OrganizationSdkUpdatesEndpoint,
    OrganizationEventDetailsEndpoint,
    OrganizationEventsStatsEndpoint,
    OrganizationEventsGeoEndpoint,
    OrganizationEventsFacetsEndpoint,
    OrganizationEventsFacetsPerformanceEndpoint,
    OrganizationEventsFacetsPerformanceHistogramEndpoint,
    OrganizationEventsSpanOpsEndpoint,
    OrganizationEventsSpansExamplesEndpoint,
    OrganizationEventsSpansPerformanceEndpoint,
    OrganizationEventsSpansStatsEndpoint,
    OrganizationEventsMetaEndpoint,
    OrganizationEventsHistogramEndpoint,
    OrganizationEventsTrendsEndpoint,
    OrganizationEventsVitalsEndpoint,
    OrganizationEventsHasMeasurementsEndpoint,
    OrganizationEventsTrendsStatsEndpoint,
    OrganizationEventsTraceLightEndpoint,
    OrganizationEventsTraceEndpoint,
    OrganizationEventsTraceMetaEndpoint,
    OrganizationGroupIndexEndpoint,
    OrganizationIssuesCountEndpoint,
    OrganizationGroupIndexStatsEndpoint,
    GroupActivitiesEndpoint,
    GroupNotesEndpoint,
    GroupNotesDetailsEndpoint,
    GroupingLevelsEndpoint,
    GroupingLevelNewIssuesEndpoint,
    GroupHashesSplitEndpoint,
    GroupReprocessingEndpoint,
    GroupStatsEndpoint,
    GroupTagsEndpoint,
    GroupUserReportsEndpoint,
    GroupAttachmentsEndpoint,
    GroupSimilarIssuesEndpoint,
    GroupExternalIssuesEndpoint,
    GroupExternalIssueDetailsEndpoint,
    GroupIntegrationsEndpoint,
    GroupIntegrationDetailsEndpoint,
    GroupCurrentReleaseEndpoint,
    GroupFirstLastReleaseEndpoint,
    OrganizationIntegrationsEndpoint,
    OrganizationIntegrationDetailsEndpoint,
    OrganizationIntegrationReposEndpoint,
    OrganizationIntegrationServerlessFunctionsEndpoint,
    OrganizationMemberIndexEndpoint,
    ExternalUserEndpoint,
    ExternalUserDetailsEndpoint,
    OrganizationIntegrationRequestEndpoint,
    OrganizationInviteRequestIndexEndpoint,
    OrganizationInviteRequestDetailsEndpoint,
    OrganizationMonitorsEndpoint,
    OrganizationPinnedSearchEndpoint,
    OrganizationRecentSearchesEndpoint,
    OrganizationSearchDetailsEndpoint,
    OrganizationSearchesEndpoint,
    OrganizationUserIssuesSearchEndpoint,
    OrganizationIssuesResolvedInReleaseEndpoint,
    OrganizationMemberDetailsEndpoint,
    OrganizationMemberUnreleasedCommitsEndpoint,
    OrganizationProcessingIssuesEndpoint,
    OrganizationProjectsCountEndpoint,
    OrganizationProjectsSentFirstEventEndpoint,
    OrganizationRepositoryDetailsEndpoint,
    OrganizationPluginsEndpoint,
    OrganizationPluginsConfigsEndpoint,
    OrganizationReleasesStatsEndpoint,
    OrganizationReleaseMetaEndpoint,
    OrganizationReleaseAssembleEndpoint,
    OrganizationReleasePreviousCommitsEndpoint,
    OrganizationUserReportsEndpoint,
    OrganizationUserTeamsEndpoint,
    OrganizationUserDetailsEndpoint,
    OrganizationSentryAppsEndpoint,
    OrganizationTagsEndpoint,
    OrganizationTagKeyValuesEndpoint,
    OrganizationOnboardingTaskEndpoint,
    OrganizationEnvironmentsEndpoint,
    OrganizationJoinRequestEndpoint,
    OrganizationRelayUsage,
    OrganizationRequestProjectCreation,
    OrganizationMetricsEndpoint,
    OrganizationMetricDetailsEndpoint,
    OrganizationMetricsDataEndpoint,
    OrganizationMetricsTagsEndpoint,
    OrganizationMetricsTagDetailsEndpoint,
    TeamGroupsOldEndpoint,
    TeamReleaseCountEndpoint,
    TeamTimeToResolutionEndpoint,
    TeamUnresolvedIssueAgeEndpoint,
    TeamAlertsTriggeredTotalsEndpoint,
    TeamAlertsTriggeredIndexEndpoint,
    TeamIssueBreakdownEndpoint,
    TeamAllUnresolvedIssuesEndpoint,
    TeamNotificationSettingsDetailsEndpoint,
    TeamMembersEndpoint,
    TeamAvatarEndpoint,
    ExternalTeamEndpoint,
    ProjectAgnosticRuleConditionsEndpoint,
    ProjectAlertRuleDetailsEndpoint,
    ProjectAlertRuleIndexEndpoint,
    ProjectAlertRuleTaskDetailsEndpoint,
    ProjectCombinedRuleIndexEndpoint,
    ProjectAvatarEndpoint,
    ProjectCreateSampleEndpoint,
    ProjectCreateSampleTransactionEndpoint,
    ProjectDocsPlatformEndpoint,
    ProjectEnvironmentsEndpoint,
    ProjectEnvironmentDetailsEndpoint,
    ProjectPlatformsEndpoint,
    EventGroupingInfoEndpoint,
    EventAppleCrashReportEndpoint,
    EventAttachmentsEndpoint,
    EventReprocessableEndpoint,
    EventAttachmentDetailsEndpoint,
    EventFileCommittersEndpoint,
    EventJsonEndpoint,
    EventOwnersEndpoint,
    SourceMapsEndpoint,
    DifAssembleEndpoint,
    AssociateDSymFilesEndpoint,
    ProjectFiltersEndpoint,
    ProjectFilterDetailsEndpoint,
    ProjectServiceHookStatsEndpoint,
    ProjectGroupStatsEndpoint,
    ProjectKeyStatsEndpoint,
    ProjectMemberIndexEndpoint,
    ProjectReleasesEndpoint,
    ProjectReleasesTokenEndpoint,
    ProjectReleaseSetupCompletionEndpoint,
    ProjectReleaseDetailsEndpoint,
    ProjectReleaseRepositories,
    ProjectReleaseStatsEndpoint,
    ProjectRulesEndpoint,
    ProjectRulesConfigurationEndpoint,
    ProjectRuleDetailsEndpoint,
    ProjectRuleTaskDetailsEndpoint,
    ProjectTagsEndpoint,
    ProjectTagKeyDetailsEndpoint,
    ProjectTeamsEndpoint,
    ProjectTransferEndpoint,
    ProjectUserDetailsEndpoint,
    ProjectUserStatsEndpoint,
    ProjectProcessingIssuesEndpoint,
    ProjectProcessingIssuesFixEndpoint,
    ProjectReprocessingEndpoint,
    ProjectProcessingIssuesDiscardEndpoint,
    ProjectOwnershipEndpoint,
    ProjectCodeOwnersEndpoint,
    ProjectCodeOwnersDetailsEndpoint,
    ProjectTransactionThresholdEndpoint,
    ProjectPluginsEndpoint,
    ProjectPluginDetailsEndpoint,
    GroupTombstoneEndpoint,
    GroupTombstoneDetailsEndpoint,
    ProjectStacktraceLinkEndpoint,
    ProjectRepoPathParsingEndpoint,
    ProjectGroupingConfigsEndpoint,
    AppStoreConnectCreateCredentialsEndpoint,
    AppStoreConnectAppsEndpoint,
    AppStoreConnectStatusEndpoint,
    AppStoreConnectUpdateCredentialsEndpoint,
    GroupParticipantsEndpoint,
    DocIntegrationsEndpoint,
    DocIntegrationDetailsEndpoint,
    DocIntegrationAvatarEndpoint,
    IntegrationFeaturesEndpoint,
    GroupingConfigsEndpoint,
    BuiltinSymbolSourcesEndpoint,
    SystemHealthEndpoint,
    SystemOptionsEndpoint,
    InternalBeaconEndpoint,
    InternalQuotasEndpoint,
    InternalQueueTasksEndpoint,
    InternalStatsEndpoint,
    InternalWarningsEndpoint,
    InternalPackagesEndpoint,
    InternalEnvironmentEndpoint,
    InternalMailEndpoint,
    SetupWizard,
    IndexEndpoint,
    CloudflareMetadataEndpoint,
    CloudflareWebhookEndpoint,
    JiraIssueUpdatedWebhook,
    JiraServerSearchEndpoint,
    SlackActionEndpoint,
    SlackCommandsEndpoint,
    SlackEventEndpoint,
    GitHubSearchEndpoint,
    GitlabIssueSearchEndpoint,
    WorkItemWebhook,
    VstsSearchEndpoint,
    BitbucketDescriptorEndpoint,
    BitbucketInstalledEndpoint,
    BitbucketUninstalledEndpoint,
    BitbucketSearchEndpoint,
    VercelWebhookEndpoint,
    MsTeamsWebhookEndpoint,
    OrganizationCodeOwnersAssociationsEndpoint,
    PluginGroupEndpoint,
    IssueGroupActionEndpoint,
    JiraServerIssueUpdatedWebhook,
    ProjectRuleGroupHistoryIndexEndpoint,
}


PUBLIC_ENDPOINTS_FROM_JSON = {f"{v.__module__}.{v.__name__}" for v in __PUBLIC_ENDPOINTS_FROM_JSON}
EXCLUDED_FROM_PUBLIC_ENDPOINTS = {
    f"{v.__module__}.{v.__name__}" for v in __EXCLUDED_FROM_PUBLIC_ENDPOINTS
}
