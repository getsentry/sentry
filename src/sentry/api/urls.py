from django.conf.urls import include, url

from sentry.api.endpoints.integration_features import IntegrationFeaturesEndpoint
from sentry.api.endpoints.organization_codeowners_associations import (
    OrganizationCodeOwnersAssociationsEndpoint,
)
from sentry.api.endpoints.organization_profiling_profiles import (
    OrganizationProfilingFiltersEndpoint,
    OrganizationProfilingProfilesEndpoint,
)
from sentry.api.endpoints.project_grouping_configs import ProjectGroupingConfigsEndpoint
from sentry.api.endpoints.project_transaction_threshold_override import (
    ProjectTransactionThresholdOverrideEndpoint,
)
from sentry.data_export.endpoints.data_export import DataExportEndpoint
from sentry.data_export.endpoints.data_export_details import DataExportDetailsEndpoint
from sentry.discover.endpoints.discover_key_transactions import (
    KeyTransactionEndpoint,
    KeyTransactionListEndpoint,
)
from sentry.discover.endpoints.discover_query import DiscoverQueryEndpoint
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
from sentry.scim.endpoints.members import OrganizationSCIMMemberDetails, OrganizationSCIMMemberIndex
from sentry.scim.endpoints.schemas import OrganizationSCIMSchemaIndex
from sentry.scim.endpoints.teams import OrganizationSCIMTeamDetails, OrganizationSCIMTeamIndex

from .endpoints.accept_organization_invite import AcceptOrganizationInvite
from .endpoints.accept_project_transfer import AcceptProjectTransferEndpoint
from .endpoints.api_application_details import ApiApplicationDetailsEndpoint
from .endpoints.api_applications import ApiApplicationsEndpoint
from .endpoints.api_authorizations import ApiAuthorizationsEndpoint
from .endpoints.api_tokens import ApiTokensEndpoint
from .endpoints.assistant import AssistantEndpoint
from .endpoints.auth_config import AuthConfigEndpoint
from .endpoints.auth_index import AuthIndexEndpoint
from .endpoints.auth_login import AuthLoginEndpoint
from .endpoints.authenticator_index import AuthenticatorIndexEndpoint
from .endpoints.broadcast_details import BroadcastDetailsEndpoint
from .endpoints.broadcast_index import BroadcastIndexEndpoint
from .endpoints.builtin_symbol_sources import BuiltinSymbolSourcesEndpoint
from .endpoints.catchall import CatchallEndpoint
from .endpoints.chunk import ChunkUploadEndpoint
from .endpoints.data_scrubbing_selector_suggestions import DataScrubbingSelectorSuggestionsEndpoint
from .endpoints.debug_files import (
    AssociateDSymFilesEndpoint,
    DebugFilesEndpoint,
    DifAssembleEndpoint,
    SourceMapsEndpoint,
    UnknownDebugFilesEndpoint,
)
from .endpoints.doc_integration_avatar import DocIntegrationAvatarEndpoint
from .endpoints.doc_integration_details import DocIntegrationDetailsEndpoint
from .endpoints.doc_integrations import DocIntegrationsEndpoint
from .endpoints.event_apple_crash_report import EventAppleCrashReportEndpoint
from .endpoints.event_attachment_details import EventAttachmentDetailsEndpoint
from .endpoints.event_attachments import EventAttachmentsEndpoint
from .endpoints.event_file_committers import EventFileCommittersEndpoint
from .endpoints.event_grouping_info import EventGroupingInfoEndpoint
from .endpoints.event_owners import EventOwnersEndpoint
from .endpoints.event_reprocessable import EventReprocessableEndpoint
from .endpoints.external_team import ExternalTeamEndpoint
from .endpoints.external_team_details import ExternalTeamDetailsEndpoint
from .endpoints.external_user import ExternalUserEndpoint
from .endpoints.external_user_details import ExternalUserDetailsEndpoint
from .endpoints.filechange import CommitFileChangeEndpoint
from .endpoints.group_activities import GroupActivitiesEndpoint
from .endpoints.group_attachments import GroupAttachmentsEndpoint
from .endpoints.group_current_release import GroupCurrentReleaseEndpoint
from .endpoints.group_details import GroupDetailsEndpoint
from .endpoints.group_events import GroupEventsEndpoint
from .endpoints.group_events_latest import GroupEventsLatestEndpoint
from .endpoints.group_events_oldest import GroupEventsOldestEndpoint
from .endpoints.group_external_issue_details import GroupExternalIssueDetailsEndpoint
from .endpoints.group_external_issues import GroupExternalIssuesEndpoint
from .endpoints.group_first_last_release import GroupFirstLastReleaseEndpoint
from .endpoints.group_hashes import GroupHashesEndpoint
from .endpoints.group_hashes_split import GroupHashesSplitEndpoint
from .endpoints.group_integration_details import GroupIntegrationDetailsEndpoint
from .endpoints.group_integrations import GroupIntegrationsEndpoint
from .endpoints.group_notes import GroupNotesEndpoint
from .endpoints.group_notes_details import GroupNotesDetailsEndpoint
from .endpoints.group_participants import GroupParticipantsEndpoint
from .endpoints.group_reprocessing import GroupReprocessingEndpoint
from .endpoints.group_similar_issues import GroupSimilarIssuesEndpoint
from .endpoints.group_stats import GroupStatsEndpoint
from .endpoints.group_tagkey_details import GroupTagKeyDetailsEndpoint
from .endpoints.group_tagkey_values import GroupTagKeyValuesEndpoint
from .endpoints.group_tags import GroupTagsEndpoint
from .endpoints.group_tombstone import GroupTombstoneEndpoint
from .endpoints.group_tombstone_details import GroupTombstoneDetailsEndpoint
from .endpoints.group_user_reports import GroupUserReportsEndpoint
from .endpoints.grouping_configs import GroupingConfigsEndpoint
from .endpoints.grouping_level_new_issues import GroupingLevelNewIssuesEndpoint
from .endpoints.grouping_levels import GroupingLevelsEndpoint
from .endpoints.index import IndexEndpoint
from .endpoints.internal_beacon import InternalBeaconEndpoint
from .endpoints.internal_environment import InternalEnvironmentEndpoint
from .endpoints.internal_mail import InternalMailEndpoint
from .endpoints.internal_packages import InternalPackagesEndpoint
from .endpoints.internal_queue_tasks import InternalQueueTasksEndpoint
from .endpoints.internal_quotas import InternalQuotasEndpoint
from .endpoints.internal_stats import InternalStatsEndpoint
from .endpoints.internal_warnings import InternalWarningsEndpoint
from .endpoints.monitor_checkin_details import MonitorCheckInDetailsEndpoint
from .endpoints.monitor_checkins import MonitorCheckInsEndpoint
from .endpoints.monitor_details import MonitorDetailsEndpoint
from .endpoints.monitor_stats import MonitorStatsEndpoint
from .endpoints.organization_access_request_details import OrganizationAccessRequestDetailsEndpoint
from .endpoints.organization_activity import OrganizationActivityEndpoint
from .endpoints.organization_api_key_details import OrganizationApiKeyDetailsEndpoint
from .endpoints.organization_api_key_index import OrganizationApiKeyIndexEndpoint
from .endpoints.organization_auditlogs import OrganizationAuditLogsEndpoint
from .endpoints.organization_auth_provider_details import OrganizationAuthProviderDetailsEndpoint
from .endpoints.organization_auth_provider_send_reminders import (
    OrganizationAuthProviderSendRemindersEndpoint,
)
from .endpoints.organization_auth_providers import OrganizationAuthProvidersEndpoint
from .endpoints.organization_avatar import OrganizationAvatarEndpoint
from .endpoints.organization_code_mapping_codeowners import (
    OrganizationCodeMappingCodeOwnersEndpoint,
)
from .endpoints.organization_code_mapping_details import OrganizationCodeMappingDetailsEndpoint
from .endpoints.organization_code_mappings import OrganizationCodeMappingsEndpoint
from .endpoints.organization_config_integrations import OrganizationConfigIntegrationsEndpoint
from .endpoints.organization_config_repositories import OrganizationConfigRepositoriesEndpoint
from .endpoints.organization_dashboard_details import (
    OrganizationDashboardDetailsEndpoint,
    OrganizationDashboardVisitEndpoint,
)
from .endpoints.organization_dashboard_widget_details import (
    OrganizationDashboardWidgetDetailsEndpoint,
)
from .endpoints.organization_dashboards import OrganizationDashboardsEndpoint
from .endpoints.organization_details import OrganizationDetailsEndpoint
from .endpoints.organization_environments import OrganizationEnvironmentsEndpoint
from .endpoints.organization_event_details import OrganizationEventDetailsEndpoint
from .endpoints.organization_eventid import EventIdLookupEndpoint
from .endpoints.organization_events import (
    OrganizationEventsGeoEndpoint,
    OrganizationEventsV2Endpoint,
)
from .endpoints.organization_events_facets import OrganizationEventsFacetsEndpoint
from .endpoints.organization_events_facets_performance import (
    OrganizationEventsFacetsPerformanceEndpoint,
    OrganizationEventsFacetsPerformanceHistogramEndpoint,
)
from .endpoints.organization_events_has_measurements import (
    OrganizationEventsHasMeasurementsEndpoint,
)
from .endpoints.organization_events_histogram import OrganizationEventsHistogramEndpoint
from .endpoints.organization_events_meta import (
    OrganizationEventsMetaEndpoint,
    OrganizationEventsRelatedIssuesEndpoint,
)
from .endpoints.organization_events_span_ops import OrganizationEventsSpanOpsEndpoint
from .endpoints.organization_events_spans_performance import (
    OrganizationEventsSpansExamplesEndpoint,
    OrganizationEventsSpansPerformanceEndpoint,
    OrganizationEventsSpansStatsEndpoint,
)
from .endpoints.organization_events_stats import OrganizationEventsStatsEndpoint
from .endpoints.organization_events_trace import (
    OrganizationEventsTraceEndpoint,
    OrganizationEventsTraceLightEndpoint,
    OrganizationEventsTraceMetaEndpoint,
)
from .endpoints.organization_events_trends import (
    OrganizationEventsTrendsEndpoint,
    OrganizationEventsTrendsStatsEndpoint,
)
from .endpoints.organization_events_vitals import OrganizationEventsVitalsEndpoint
from .endpoints.organization_group_index import OrganizationGroupIndexEndpoint
from .endpoints.organization_group_index_stats import OrganizationGroupIndexStatsEndpoint
from .endpoints.organization_has_mobile_app_events import OrganizationHasMobileAppEvents
from .endpoints.organization_index import OrganizationIndexEndpoint
from .endpoints.organization_integration_details import OrganizationIntegrationDetailsEndpoint
from .endpoints.organization_integration_repos import OrganizationIntegrationReposEndpoint
from .endpoints.organization_integration_request import OrganizationIntegrationRequestEndpoint
from .endpoints.organization_integration_serverless_functions import (
    OrganizationIntegrationServerlessFunctionsEndpoint,
)
from .endpoints.organization_integrations import OrganizationIntegrationsEndpoint
from .endpoints.organization_invite_request_details import OrganizationInviteRequestDetailsEndpoint
from .endpoints.organization_invite_request_index import OrganizationInviteRequestIndexEndpoint
from .endpoints.organization_issues_count import OrganizationIssuesCountEndpoint
from .endpoints.organization_issues_resolved_in_release import (
    OrganizationIssuesResolvedInReleaseEndpoint,
)
from .endpoints.organization_join_request import OrganizationJoinRequestEndpoint
from .endpoints.organization_member_details import OrganizationMemberDetailsEndpoint
from .endpoints.organization_member_index import OrganizationMemberIndexEndpoint
from .endpoints.organization_member_issues_assigned import OrganizationMemberIssuesAssignedEndpoint
from .endpoints.organization_member_issues_bookmarked import (
    OrganizationMemberIssuesBookmarkedEndpoint,
)
from .endpoints.organization_member_issues_viewed import OrganizationMemberIssuesViewedEndpoint
from .endpoints.organization_member_team_details import OrganizationMemberTeamDetailsEndpoint
from .endpoints.organization_member_unreleased_commits import (
    OrganizationMemberUnreleasedCommitsEndpoint,
)
from .endpoints.organization_metrics import (
    OrganizationMetricDetailsEndpoint,
    OrganizationMetricsDataEndpoint,
    OrganizationMetricsEndpoint,
    OrganizationMetricsTagDetailsEndpoint,
    OrganizationMetricsTagsEndpoint,
)
from .endpoints.organization_monitors import OrganizationMonitorsEndpoint
from .endpoints.organization_onboarding_tasks import OrganizationOnboardingTaskEndpoint
from .endpoints.organization_pinned_searches import OrganizationPinnedSearchEndpoint
from .endpoints.organization_plugins import OrganizationPluginsEndpoint
from .endpoints.organization_plugins_configs import OrganizationPluginsConfigsEndpoint
from .endpoints.organization_processingissues import OrganizationProcessingIssuesEndpoint
from .endpoints.organization_projects import (
    OrganizationProjectsCountEndpoint,
    OrganizationProjectsEndpoint,
)
from .endpoints.organization_projects_sent_first_event import (
    OrganizationProjectsSentFirstEventEndpoint,
)
from .endpoints.organization_recent_searches import OrganizationRecentSearchesEndpoint
from .endpoints.organization_relay_usage import OrganizationRelayUsage
from .endpoints.organization_release_assemble import OrganizationReleaseAssembleEndpoint
from .endpoints.organization_release_commits import OrganizationReleaseCommitsEndpoint
from .endpoints.organization_release_details import OrganizationReleaseDetailsEndpoint
from .endpoints.organization_release_file_details import OrganizationReleaseFileDetailsEndpoint
from .endpoints.organization_release_files import OrganizationReleaseFilesEndpoint
from .endpoints.organization_release_meta import OrganizationReleaseMetaEndpoint
from .endpoints.organization_release_previous_commits import (
    OrganizationReleasePreviousCommitsEndpoint,
)
from .endpoints.organization_releases import (
    OrganizationReleasesEndpoint,
    OrganizationReleasesStatsEndpoint,
)
from .endpoints.organization_repositories import OrganizationRepositoriesEndpoint
from .endpoints.organization_repository_commits import OrganizationRepositoryCommitsEndpoint
from .endpoints.organization_repository_details import OrganizationRepositoryDetailsEndpoint
from .endpoints.organization_request_project_creation import OrganizationRequestProjectCreation
from .endpoints.organization_sdk_updates import OrganizationSdkUpdatesEndpoint
from .endpoints.organization_search_details import OrganizationSearchDetailsEndpoint
from .endpoints.organization_searches import OrganizationSearchesEndpoint
from .endpoints.organization_sentry_apps import OrganizationSentryAppsEndpoint
from .endpoints.organization_sessions import OrganizationSessionsEndpoint
from .endpoints.organization_shortid import ShortIdLookupEndpoint
from .endpoints.organization_slugs import SlugsUpdateEndpoint
from .endpoints.organization_stats import OrganizationStatsEndpoint
from .endpoints.organization_stats_v2 import OrganizationStatsEndpointV2
from .endpoints.organization_tagkey_values import OrganizationTagKeyValuesEndpoint
from .endpoints.organization_tags import OrganizationTagsEndpoint
from .endpoints.organization_teams import OrganizationTeamsEndpoint
from .endpoints.organization_transaction_anomaly_detection import (
    OrganizationTransactionAnomalyDetectionEndpoint,
)
from .endpoints.organization_user_details import OrganizationUserDetailsEndpoint
from .endpoints.organization_user_issues import OrganizationUserIssuesEndpoint
from .endpoints.organization_user_issues_search import OrganizationUserIssuesSearchEndpoint
from .endpoints.organization_user_reports import OrganizationUserReportsEndpoint
from .endpoints.organization_user_teams import OrganizationUserTeamsEndpoint
from .endpoints.organization_users import OrganizationUsersEndpoint
from .endpoints.project_agnostic_rule_conditions import ProjectAgnosticRuleConditionsEndpoint
from .endpoints.project_app_store_connect_credentials import (
    AppStoreConnectAppsEndpoint,
    AppStoreConnectCreateCredentialsEndpoint,
    AppStoreConnectStatusEndpoint,
    AppStoreConnectUpdateCredentialsEndpoint,
)
from .endpoints.project_avatar import ProjectAvatarEndpoint
from .endpoints.project_codeowners import ProjectCodeOwnersEndpoint
from .endpoints.project_codeowners_details import ProjectCodeOwnersDetailsEndpoint
from .endpoints.project_codeowners_request import ProjectCodeOwnersRequestEndpoint
from .endpoints.project_create_sample import ProjectCreateSampleEndpoint
from .endpoints.project_create_sample_transaction import ProjectCreateSampleTransactionEndpoint
from .endpoints.project_details import ProjectDetailsEndpoint
from .endpoints.project_docs_platform import ProjectDocsPlatformEndpoint
from .endpoints.project_environment_details import ProjectEnvironmentDetailsEndpoint
from .endpoints.project_environments import ProjectEnvironmentsEndpoint
from .endpoints.project_event_details import EventJsonEndpoint, ProjectEventDetailsEndpoint
from .endpoints.project_events import ProjectEventsEndpoint
from .endpoints.project_filter_details import ProjectFilterDetailsEndpoint
from .endpoints.project_filters import ProjectFiltersEndpoint
from .endpoints.project_group_index import ProjectGroupIndexEndpoint
from .endpoints.project_group_stats import ProjectGroupStatsEndpoint
from .endpoints.project_index import ProjectIndexEndpoint
from .endpoints.project_issues_resolved_in_release import ProjectIssuesResolvedInReleaseEndpoint
from .endpoints.project_key_details import ProjectKeyDetailsEndpoint
from .endpoints.project_key_stats import ProjectKeyStatsEndpoint
from .endpoints.project_keys import ProjectKeysEndpoint
from .endpoints.project_member_index import ProjectMemberIndexEndpoint
from .endpoints.project_ownership import ProjectOwnershipEndpoint
from .endpoints.project_platforms import ProjectPlatformsEndpoint
from .endpoints.project_plugin_details import ProjectPluginDetailsEndpoint
from .endpoints.project_plugins import ProjectPluginsEndpoint
from .endpoints.project_processingissues import (
    ProjectProcessingIssuesDiscardEndpoint,
    ProjectProcessingIssuesEndpoint,
    ProjectProcessingIssuesFixEndpoint,
)
from .endpoints.project_profiling_profile import ProjectProfilingProfileEndpoint
from .endpoints.project_release_commits import ProjectReleaseCommitsEndpoint
from .endpoints.project_release_details import ProjectReleaseDetailsEndpoint
from .endpoints.project_release_file_details import ProjectReleaseFileDetailsEndpoint
from .endpoints.project_release_files import ProjectReleaseFilesEndpoint
from .endpoints.project_release_repositories import ProjectReleaseRepositories
from .endpoints.project_release_setup import ProjectReleaseSetupCompletionEndpoint
from .endpoints.project_release_stats import ProjectReleaseStatsEndpoint
from .endpoints.project_releases import ProjectReleasesEndpoint
from .endpoints.project_releases_token import ProjectReleasesTokenEndpoint
from .endpoints.project_repo_path_parsing import ProjectRepoPathParsingEndpoint
from .endpoints.project_reprocessing import ProjectReprocessingEndpoint
from .endpoints.project_rule_details import ProjectRuleDetailsEndpoint
from .endpoints.project_rule_task_details import ProjectRuleTaskDetailsEndpoint
from .endpoints.project_rules import ProjectRulesEndpoint
from .endpoints.project_rules_configuration import ProjectRulesConfigurationEndpoint
from .endpoints.project_search_details import ProjectSearchDetailsEndpoint
from .endpoints.project_searches import ProjectSearchesEndpoint
from .endpoints.project_servicehook_details import ProjectServiceHookDetailsEndpoint
from .endpoints.project_servicehook_stats import ProjectServiceHookStatsEndpoint
from .endpoints.project_servicehooks import ProjectServiceHooksEndpoint
from .endpoints.project_stacktrace_link import ProjectStacktraceLinkEndpoint
from .endpoints.project_stats import ProjectStatsEndpoint
from .endpoints.project_tagkey_details import ProjectTagKeyDetailsEndpoint
from .endpoints.project_tagkey_values import ProjectTagKeyValuesEndpoint
from .endpoints.project_tags import ProjectTagsEndpoint
from .endpoints.project_team_details import ProjectTeamDetailsEndpoint
from .endpoints.project_teams import ProjectTeamsEndpoint
from .endpoints.project_transaction_threshold import ProjectTransactionThresholdEndpoint
from .endpoints.project_transfer import ProjectTransferEndpoint
from .endpoints.project_user_details import ProjectUserDetailsEndpoint
from .endpoints.project_user_reports import ProjectUserReportsEndpoint
from .endpoints.project_user_stats import ProjectUserStatsEndpoint
from .endpoints.project_users import ProjectUsersEndpoint
from .endpoints.prompts_activity import PromptsActivityEndpoint
from .endpoints.relay import (
    RelayDetailsEndpoint,
    RelayHealthCheck,
    RelayIndexEndpoint,
    RelayProjectConfigsEndpoint,
    RelayProjectIdsEndpoint,
    RelayPublicKeysEndpoint,
    RelayRegisterChallengeEndpoint,
    RelayRegisterResponseEndpoint,
)
from .endpoints.release_deploys import ReleaseDeploysEndpoint
from .endpoints.sentry_app import (
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
    SentryAppInteractionEndpoint,
    SentryAppPublishRequestEndpoint,
    SentryAppRequestsEndpoint,
    SentryAppsEndpoint,
    SentryAppsStatsEndpoint,
    SentryAppStatsEndpoint,
    SentryInternalAppTokenDetailsEndpoint,
    SentryInternalAppTokensEndpoint,
)
from .endpoints.sentry_app_avatar import SentryAppAvatarEndpoint
from .endpoints.setup_wizard import SetupWizard
from .endpoints.shared_group_details import SharedGroupDetailsEndpoint
from .endpoints.system_health import SystemHealthEndpoint
from .endpoints.system_options import SystemOptionsEndpoint
from .endpoints.team_alerts_triggered import (
    TeamAlertsTriggeredIndexEndpoint,
    TeamAlertsTriggeredTotalsEndpoint,
)
from .endpoints.team_all_unresolved_issues import TeamAllUnresolvedIssuesEndpoint
from .endpoints.team_avatar import TeamAvatarEndpoint
from .endpoints.team_details import TeamDetailsEndpoint
from .endpoints.team_groups_old import TeamGroupsOldEndpoint
from .endpoints.team_issue_breakdown import TeamIssueBreakdownEndpoint
from .endpoints.team_members import TeamMembersEndpoint
from .endpoints.team_notification_settings_details import TeamNotificationSettingsDetailsEndpoint
from .endpoints.team_projects import TeamProjectsEndpoint
from .endpoints.team_release_count import TeamReleaseCountEndpoint
from .endpoints.team_stats import TeamStatsEndpoint
from .endpoints.team_time_to_resolution import TeamTimeToResolutionEndpoint
from .endpoints.team_unresolved_issue_age import TeamUnresolvedIssueAgeEndpoint
from .endpoints.user_authenticator_details import UserAuthenticatorDetailsEndpoint
from .endpoints.user_authenticator_enroll import UserAuthenticatorEnrollEndpoint
from .endpoints.user_authenticator_index import UserAuthenticatorIndexEndpoint
from .endpoints.user_details import UserDetailsEndpoint
from .endpoints.user_emails import UserEmailsEndpoint
from .endpoints.user_emails_confirm import UserEmailsConfirmEndpoint
from .endpoints.user_identity import UserIdentityEndpoint
from .endpoints.user_identity_config import (
    UserIdentityConfigDetailsEndpoint,
    UserIdentityConfigEndpoint,
)
from .endpoints.user_identity_details import UserIdentityDetailsEndpoint
from .endpoints.user_index import UserIndexEndpoint
from .endpoints.user_ips import UserIPsEndpoint
from .endpoints.user_notification_details import UserNotificationDetailsEndpoint
from .endpoints.user_notification_fine_tuning import UserNotificationFineTuningEndpoint
from .endpoints.user_notification_settings_details import UserNotificationSettingsDetailsEndpoint
from .endpoints.user_organizationintegrations import UserOrganizationIntegrationsEndpoint
from .endpoints.user_organizations import UserOrganizationsEndpoint
from .endpoints.user_password import UserPasswordEndpoint
from .endpoints.user_permission_details import UserPermissionDetailsEndpoint
from .endpoints.user_permissions import UserPermissionsEndpoint
from .endpoints.user_permissions_config import UserPermissionsConfigEndpoint
from .endpoints.user_role_details import UserUserRoleDetailsEndpoint
from .endpoints.user_roles import UserUserRolesEndpoint
from .endpoints.user_social_identities_index import UserSocialIdentitiesIndexEndpoint
from .endpoints.user_social_identity_details import UserSocialIdentityDetailsEndpoint
from .endpoints.user_subscriptions import UserSubscriptionsEndpoint
from .endpoints.useravatar import UserAvatarEndpoint
from .endpoints.userroles_details import UserRoleDetailsEndpoint
from .endpoints.userroles_index import UserRolesEndpoint

# issues endpoints are available both top level (by numerical ID) as well as coupled
# to the organization (and queryable via short ID)
GROUP_URLS = [
    url(r"^(?P<issue_id>[^\/]+)/$", GroupDetailsEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/activities/$", GroupActivitiesEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/events/$", GroupEventsEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/events/latest/$", GroupEventsLatestEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/events/oldest/$", GroupEventsOldestEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/(?:notes|comments)/$", GroupNotesEndpoint.as_view()),
    url(
        r"^(?P<issue_id>[^\/]+)/(?:notes|comments)/(?P<note_id>[^\/]+)/$",
        GroupNotesDetailsEndpoint.as_view(),
    ),
    url(r"^(?P<issue_id>[^\/]+)/hashes/$", GroupHashesEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/grouping/levels/$", GroupingLevelsEndpoint.as_view()),
    url(
        r"^(?P<issue_id>[^\/]+)/grouping/levels/(?P<id>[^\/]+)/new-issues/$",
        GroupingLevelNewIssuesEndpoint.as_view(),
    ),
    url(r"^(?P<issue_id>[^\/]+)/hashes/split/$", GroupHashesSplitEndpoint.as_view()),
    url(
        r"^(?P<issue_id>[^\/]+)/reprocessing/$",
        GroupReprocessingEndpoint.as_view(),
        name="sentry-api-0-issues-reprocessing",
    ),
    url(r"^(?P<issue_id>[^\/]+)/stats/$", GroupStatsEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/tags/$", GroupTagsEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/tags/(?P<key>[^/]+)/$", GroupTagKeyDetailsEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/tags/(?P<key>[^/]+)/values/$", GroupTagKeyValuesEndpoint.as_view()),
    url(
        r"^(?P<issue_id>[^\/]+)/(?:user-feedback|user-reports)/$",
        GroupUserReportsEndpoint.as_view(),
    ),
    url(r"^(?P<issue_id>[^\/]+)/attachments/$", GroupAttachmentsEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/similar/$", GroupSimilarIssuesEndpoint.as_view()),
    url(
        r"^(?P<issue_id>[^\/]+)/external-issues/$",
        GroupExternalIssuesEndpoint.as_view(),
        name="external-issues",
    ),
    url(
        r"^(?P<issue_id>[^\/]+)/external-issues/(?P<external_issue_id>\d+)/$",
        GroupExternalIssueDetailsEndpoint.as_view(),
    ),
    url(r"^(?P<issue_id>[^\/]+)/integrations/$", GroupIntegrationsEndpoint.as_view()),
    url(
        r"^(?P<issue_id>[^\/]+)/integrations/(?P<integration_id>\d+)/$",
        GroupIntegrationDetailsEndpoint.as_view(),
        name="integration-details",
    ),
    url(r"^(?P<issue_id>[^\/]+)/current-release/$", GroupCurrentReleaseEndpoint.as_view()),
    url(r"^(?P<issue_id>[^\/]+)/first-last-release/$", GroupFirstLastReleaseEndpoint.as_view()),
    # Load plugin group urls
    url(r"^(?P<issue_id>[^\/]+)/plugins?/", include("sentry.plugins.base.group_api_urls")),
]

urlpatterns = [
    # Relay
    url(
        r"^relays/",
        include(
            [
                url(r"^$", RelayIndexEndpoint.as_view(), name="sentry-api-0-relays-index"),
                url(
                    r"^register/challenge/$",
                    RelayRegisterChallengeEndpoint.as_view(),
                    name="sentry-api-0-relay-register-challenge",
                ),
                url(
                    r"^register/response/$",
                    RelayRegisterResponseEndpoint.as_view(),
                    name="sentry-api-0-relay-register-response",
                ),
                url(
                    r"^projectconfigs/$",
                    RelayProjectConfigsEndpoint.as_view(),
                    name="sentry-api-0-relay-projectconfigs",
                ),
                url(
                    r"^projectids/$",
                    RelayProjectIdsEndpoint.as_view(),
                    name="sentry-api-0-relay-projectids",
                ),
                url(
                    r"^publickeys/$",
                    RelayPublicKeysEndpoint.as_view(),
                    name="sentry-api-0-relay-publickeys",
                ),
                url(
                    r"^live/$",
                    RelayHealthCheck.as_view(),
                    name="sentry-api-0-relays-healthcheck",
                ),
                url(
                    r"^(?P<relay_id>[^\/]+)/$",
                    RelayDetailsEndpoint.as_view(),
                    name="sentry-api-0-relays-details",
                ),
            ]
        ),
    ),
    # Api Data
    url(r"^assistant/$", AssistantEndpoint.as_view(), name="sentry-api-0-assistant"),
    url(
        r"^api-applications/$",
        ApiApplicationsEndpoint.as_view(),
        name="sentry-api-0-api-applications",
    ),
    url(
        r"^api-applications/(?P<app_id>[^\/]+)/$",
        ApiApplicationDetailsEndpoint.as_view(),
        name="sentry-api-0-api-application-details",
    ),
    url(
        r"^api-authorizations/$",
        ApiAuthorizationsEndpoint.as_view(),
        name="sentry-api-0-api-authorizations",
    ),
    url(r"^api-tokens/$", ApiTokensEndpoint.as_view(), name="sentry-api-0-api-tokens"),
    url(
        r"^prompts-activity/$",
        PromptsActivityEndpoint.as_view(),
        name="sentry-api-0-prompts-activity",
    ),
    # Auth
    url(
        r"^auth/",
        include(
            [
                url(r"^$", AuthIndexEndpoint.as_view(), name="sentry-api-0-auth"),
                url(r"^config/$", AuthConfigEndpoint.as_view(), name="sentry-api-0-auth-config"),
                url(r"^login/$", AuthLoginEndpoint.as_view(), name="sentry-api-0-auth-login"),
            ]
        ),
    ),
    # List Authenticators
    url(
        r"^authenticators/$",
        AuthenticatorIndexEndpoint.as_view(),
        name="sentry-api-0-authenticator-index",
    ),
    # Broadcasts
    url(r"^broadcasts/$", BroadcastIndexEndpoint.as_view(), name="sentry-api-0-broadcast-index"),
    url(r"^broadcasts/(?P<broadcast_id>[^\/]+)/$", BroadcastDetailsEndpoint.as_view()),
    # Project transfer
    url(
        r"^accept-transfer/$",
        AcceptProjectTransferEndpoint.as_view(),
        name="sentry-api-0-accept-project-transfer",
    ),
    # Organization invite
    url(
        r"^accept-invite/(?P<member_id>[^\/]+)/(?P<token>[^\/]+)/$",
        AcceptOrganizationInvite.as_view(),
        name="sentry-api-0-accept-organization-invite",
    ),
    # Monitors
    url(
        r"^monitors/",
        include(
            [
                url(r"^(?P<monitor_id>[^\/]+)/$", MonitorDetailsEndpoint.as_view()),
                url(r"^(?P<monitor_id>[^\/]+)/checkins/$", MonitorCheckInsEndpoint.as_view()),
                url(
                    r"^(?P<monitor_id>[^\/]+)/checkins/(?P<checkin_id>[^\/]+)/$",
                    MonitorCheckInDetailsEndpoint.as_view(),
                ),
                url(r"^(?P<monitor_id>[^\/]+)/stats/$", MonitorStatsEndpoint.as_view()),
            ]
        ),
    ),
    # Users
    url(
        r"^users/",
        include(
            [
                url(r"^$", UserIndexEndpoint.as_view(), name="sentry-api-0-user-index"),
                url(
                    r"^(?P<user_id>[^\/]+)/$",
                    UserDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-details",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/avatar/$",
                    UserAvatarEndpoint.as_view(),
                    name="sentry-api-0-user-avatar",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/authenticators/$",
                    UserAuthenticatorIndexEndpoint.as_view(),
                    name="sentry-api-0-user-authenticator-index",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/authenticators/(?P<interface_id>[^\/]+)/enroll/$",
                    UserAuthenticatorEnrollEndpoint.as_view(),
                    name="sentry-api-0-user-authenticator-enroll",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/authenticators/(?P<auth_id>[^\/]+)/(?P<interface_device_id>[^\/]+)/$",
                    UserAuthenticatorDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-authenticator-device-details",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/authenticators/(?P<auth_id>[^\/]+)/$",
                    UserAuthenticatorDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-authenticator-details",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/emails/$",
                    UserEmailsEndpoint.as_view(),
                    name="sentry-api-0-user-emails",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/emails/confirm/$",
                    UserEmailsConfirmEndpoint.as_view(),
                    name="sentry-api-0-user-emails-confirm",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/identities/(?P<identity_id>[^\/]+)/$",
                    UserIdentityDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-identity-details",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/identities/$",
                    UserIdentityEndpoint.as_view(),
                    name="sentry-api-0-user-identity",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/ips/$",
                    UserIPsEndpoint.as_view(),
                    name="sentry-api-0-user-ips",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/organizations/$",
                    UserOrganizationsEndpoint.as_view(),
                    name="sentry-api-0-user-organizations",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/notification-settings/$",
                    UserNotificationSettingsDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-notification-settings",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/notifications/$",
                    UserNotificationDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-notifications",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/notifications/(?P<notification_type>[^\/]+)/$",
                    UserNotificationFineTuningEndpoint.as_view(),
                    name="sentry-api-0-user-notifications-fine-tuning",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/password/$",
                    UserPasswordEndpoint.as_view(),
                    name="sentry-api-0-user-password",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/permissions/$",
                    UserPermissionsEndpoint.as_view(),
                    name="sentry-api-0-user-permissions",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/permissions/config/$",
                    UserPermissionsConfigEndpoint.as_view(),
                    name="sentry-api-0-user-permissions-config",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/permissions/(?P<permission_name>[^\/]+)/$",
                    UserPermissionDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-permission-details",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/roles/$",
                    UserUserRolesEndpoint.as_view(),
                    name="sentry-api-0-user-userroles",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/roles/(?P<role_name>[^\/]+)/$",
                    UserUserRoleDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-userrole-details",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/social-identities/$",
                    UserSocialIdentitiesIndexEndpoint.as_view(),
                    name="sentry-api-0-user-social-identities-index",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/social-identities/(?P<identity_id>[^\/]+)/$",
                    UserSocialIdentityDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-social-identity-details",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/subscriptions/$",
                    UserSubscriptionsEndpoint.as_view(),
                    name="sentry-api-0-user-subscriptions",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/organization-integrations/$",
                    UserOrganizationIntegrationsEndpoint.as_view(),
                    name="sentry-api-0-user-organization-integrations",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/user-identities/$",
                    UserIdentityConfigEndpoint.as_view(),
                    name="sentry-api-0-user-identity-config",
                ),
                url(
                    r"^(?P<user_id>[^\/]+)/user-identities/(?P<category>[\w-]+)/(?P<identity_id>[^\/]+)/$",
                    UserIdentityConfigDetailsEndpoint.as_view(),
                    name="sentry-api-0-user-identity-config-details",
                ),
            ]
        ),
    ),
    # UserRoles
    url(
        r"^userroles/",
        include(
            [
                url(
                    r"^$",
                    UserRolesEndpoint.as_view(),
                    name="sentry-api-0-userroles",
                ),
                url(
                    r"^(?P<role_name>[^\/]+)/$",
                    UserRoleDetailsEndpoint.as_view(),
                    name="sentry-api-0-userroles-details",
                ),
            ]
        ),
    ),
    # Organizations
    url(
        r"^organizations/",
        include(
            [
                url(r"^$", OrganizationIndexEndpoint.as_view(), name="sentry-api-0-organizations"),
                url(
                    r"^(?P<organization_slug>[^\/]+)/$",
                    OrganizationDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-details",
                ),
                # Alert Rules
                url(
                    r"^(?P<organization_slug>[^\/]+)/alert-rules/available-actions/$",
                    OrganizationAlertRuleAvailableActionIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-alert-rule-available-actions",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/alert-rules/(?P<alert_rule_id>[^\/]+)/$",
                    OrganizationAlertRuleDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-alert-rule-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/alert-rules/$",
                    OrganizationAlertRuleIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-alert-rules",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/combined-rules/$",
                    OrganizationCombinedRuleIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-combined-rules",
                ),
                # Data Export
                url(
                    r"^(?P<organization_slug>[^\/]+)/data-export/$",
                    DataExportEndpoint.as_view(),
                    name="sentry-api-0-organization-data-export",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/data-export/(?P<data_export_id>[^\/]+)/$",
                    DataExportDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-data-export-details",
                ),
                # Incidents
                url(
                    r"^(?P<organization_slug>[^\/]+)/incidents/(?P<incident_identifier>[^\/]+)/activity/$",
                    OrganizationIncidentActivityIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-incident-activity",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/incidents/(?P<incident_identifier>[^\/]+)/comments/$",
                    OrganizationIncidentCommentIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-incident-comments",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/incidents/(?P<incident_identifier>[^\/]+)/comments/(?P<activity_id>[^\/]+)/$",
                    OrganizationIncidentCommentDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-incident-comment-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/incidents/(?P<incident_identifier>[^\/]+)/$",
                    OrganizationIncidentDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-incident-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/incidents/$",
                    OrganizationIncidentIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-incident-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/incidents/(?P<incident_identifier>[^\/]+)/seen/$",
                    OrganizationIncidentSeenEndpoint.as_view(),
                    name="sentry-api-0-organization-incident-seen",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/incidents/(?P<incident_identifier>[^\/]+)/subscriptions/$",
                    OrganizationIncidentSubscriptionIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-incident-subscription-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/chunk-upload/$",
                    ChunkUploadEndpoint.as_view(),
                    name="sentry-api-0-chunk-upload",
                ),
                # Code Path Mappings
                url(
                    r"^(?P<organization_slug>[^\/]+)/code-mappings/$",
                    OrganizationCodeMappingsEndpoint.as_view(),
                    name="sentry-api-0-organization-code-mappings",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/code-mappings/(?P<config_id>[^\/]+)/$",
                    OrganizationCodeMappingDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-code-mapping-details",
                ),
                # Codeowners
                url(
                    r"^(?P<organization_slug>[^\/]+)/code-mappings/(?P<config_id>[^\/]+)/codeowners/$",
                    OrganizationCodeMappingCodeOwnersEndpoint.as_view(),
                    name="sentry-api-0-organization-code-mapping-codeowners",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/codeowners-associations/$",
                    OrganizationCodeOwnersAssociationsEndpoint.as_view(),
                    name="sentry-api-0-organization-codeowners-associations",
                ),
                # Discover
                url(
                    r"^(?P<organization_slug>[^\/]+)/discover/query/$",
                    DiscoverQueryEndpoint.as_view(),
                    name="sentry-api-0-discover-query",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/discover/saved/$",
                    DiscoverSavedQueriesEndpoint.as_view(),
                    name="sentry-api-0-discover-saved-queries",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/discover/saved/(?P<query_id>\d+)/$",
                    DiscoverSavedQueryDetailEndpoint.as_view(),
                    name="sentry-api-0-discover-saved-query-detail",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/discover/saved/(?P<query_id>\d+)/visit/$",
                    DiscoverSavedQueryVisitEndpoint.as_view(),
                    name="sentry-api-0-discover-saved-query-visit",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/key-transactions/$",
                    KeyTransactionEndpoint.as_view(),
                    name="sentry-api-0-organization-key-transactions",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/key-transactions-list/$",
                    KeyTransactionListEndpoint.as_view(),
                    name="sentry-api-0-organization-key-transactions-list",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/related-issues/$",
                    OrganizationEventsRelatedIssuesEndpoint.as_view(),
                    name="sentry-api-0-organization-related-issues",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/project-transaction-threshold-override/$",
                    ProjectTransactionThresholdOverrideEndpoint.as_view(),
                    name="sentry-api-0-organization-project-transaction-threshold-override",
                ),
                # Dashboards
                url(
                    r"^(?P<organization_slug>[^\/]+)/dashboards/$",
                    OrganizationDashboardsEndpoint.as_view(),
                    name="sentry-api-0-organization-dashboards",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/dashboards/widgets/$",
                    OrganizationDashboardWidgetDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-dashboard-widget-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/dashboards/(?P<dashboard_id>[^\/]+)/$",
                    OrganizationDashboardDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-dashboard-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/dashboards/(?P<dashboard_id>[^\/]+)/visit/$",
                    OrganizationDashboardVisitEndpoint.as_view(),
                    name="sentry-api-0-organization-dashboard-visit",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/shortids/(?P<short_id>[^\/]+)/$",
                    ShortIdLookupEndpoint.as_view(),
                    name="sentry-api-0-short-id-lookup",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/eventids/(?P<event_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
                    EventIdLookupEndpoint.as_view(),
                    name="sentry-api-0-event-id-lookup",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/data-scrubbing-selector-suggestions/$",
                    DataScrubbingSelectorSuggestionsEndpoint.as_view(),
                    name="sentry-api-0-data-scrubbing-selector-suggestions",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/slugs/$",
                    SlugsUpdateEndpoint.as_view(),
                    name="sentry-api-0-short-ids-update",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/access-requests/$",
                    OrganizationAccessRequestDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-access-requests",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/access-requests/(?P<request_id>\d+)/$",
                    OrganizationAccessRequestDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-access-request-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/activity/$",
                    OrganizationActivityEndpoint.as_view(),
                    name="sentry-api-0-organization-activity",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/api-keys/$",
                    OrganizationApiKeyIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-api-key-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/api-keys/(?P<api_key_id>[^\/]+)/$",
                    OrganizationApiKeyDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-api-key-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/audit-logs/$",
                    OrganizationAuditLogsEndpoint.as_view(),
                    name="sentry-api-0-organization-audit-logs",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/auth-provider/$",
                    OrganizationAuthProviderDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-auth-provider",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/auth-providers/$",
                    OrganizationAuthProvidersEndpoint.as_view(),
                    name="sentry-api-0-organization-auth-providers",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/auth-provider/send-reminders/$",
                    OrganizationAuthProviderSendRemindersEndpoint.as_view(),
                    name="sentry-api-0-organization-auth-provider-send-reminders",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/avatar/$",
                    OrganizationAvatarEndpoint.as_view(),
                    name="sentry-api-0-organization-avatar",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/config/integrations/$",
                    OrganizationConfigIntegrationsEndpoint.as_view(),
                    name="sentry-api-0-organization-config-integrations",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/config/repos/$",
                    OrganizationConfigRepositoriesEndpoint.as_view(),
                    name="sentry-api-0-organization-config-repositories",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/sdk-updates/$",
                    OrganizationSdkUpdatesEndpoint.as_view(),
                    name="sentry-api-0-organization-sdk-updates",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/has-mobile-app-events/$",
                    OrganizationHasMobileAppEvents.as_view(),
                    name="sentry-api-0-organization-has-mobile-events",
                ),
                # TODO add an alias for /organizations/:slug/events/ and deprecate eventsv2
                url(
                    r"^(?P<organization_slug>[^\/]+)/eventsv2/$",
                    OrganizationEventsV2Endpoint.as_view(),
                    name="sentry-api-0-organization-eventsv2",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events/(?P<project_slug>[^\/]+):(?P<event_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
                    OrganizationEventDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-event-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-stats/$",
                    OrganizationEventsStatsEndpoint.as_view(),
                    name="sentry-api-0-organization-events-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-geo/$",
                    OrganizationEventsGeoEndpoint.as_view(),
                    name="sentry-api-0-organization-events-geo",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-facets/$",
                    OrganizationEventsFacetsEndpoint.as_view(),
                    name="sentry-api-0-organization-events-facets",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-facets-performance/$",
                    OrganizationEventsFacetsPerformanceEndpoint.as_view(),
                    name="sentry-api-0-organization-events-facets-performance",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-facets-performance-histogram/$",
                    OrganizationEventsFacetsPerformanceHistogramEndpoint.as_view(),
                    name="sentry-api-0-organization-events-facets-performance-histogram",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-span-ops/$",
                    OrganizationEventsSpanOpsEndpoint.as_view(),
                    name="sentry-api-0-organization-events-span-ops",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-spans/$",
                    OrganizationEventsSpansExamplesEndpoint.as_view(),
                    name="sentry-api-0-organization-events-spans",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-spans-performance/$",
                    OrganizationEventsSpansPerformanceEndpoint.as_view(),
                    name="sentry-api-0-organization-events-spans-performance",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-spans-stats/$",
                    OrganizationEventsSpansStatsEndpoint.as_view(),
                    name="sentry-api-0-organization-events-spans-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-meta/$",
                    OrganizationEventsMetaEndpoint.as_view(),
                    name="sentry-api-0-organization-events-meta",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-histogram/$",
                    OrganizationEventsHistogramEndpoint.as_view(),
                    name="sentry-api-0-organization-events-histogram",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-trends/$",
                    OrganizationEventsTrendsEndpoint.as_view(),
                    name="sentry-api-0-organization-events-trends",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-vitals/$",
                    OrganizationEventsVitalsEndpoint.as_view(),
                    name="sentry-api-0-organization-events-vitals",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-has-measurements/$",
                    OrganizationEventsHasMeasurementsEndpoint.as_view(),
                    name="sentry-api-0-organization-events-has-measurements",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-trends-stats/$",
                    OrganizationEventsTrendsStatsEndpoint.as_view(),
                    name="sentry-api-0-organization-events-trends-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-trace-light/(?P<trace_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
                    OrganizationEventsTraceLightEndpoint.as_view(),
                    name="sentry-api-0-organization-events-trace-light",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-trace/(?P<trace_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
                    OrganizationEventsTraceEndpoint.as_view(),
                    name="sentry-api-0-organization-events-trace",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/events-trace-meta/(?P<trace_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
                    OrganizationEventsTraceMetaEndpoint.as_view(),
                    name="sentry-api-0-organization-events-trace-meta",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/issues/$",
                    OrganizationGroupIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-group-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/issues-count/$",
                    OrganizationIssuesCountEndpoint.as_view(),
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/issues-stats/$",
                    OrganizationGroupIndexStatsEndpoint.as_view(),
                    name="sentry-api-0-organization-group-index-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?:issues|groups)/",
                    include(GROUP_URLS),
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/integrations/$",
                    OrganizationIntegrationsEndpoint.as_view(),
                    name="sentry-api-0-organization-integrations",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/integrations/(?P<integration_id>[^\/]+)/$",
                    OrganizationIntegrationDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-integration-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/integrations/(?P<integration_id>[^\/]+)/repos/$",
                    OrganizationIntegrationReposEndpoint.as_view(),
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/integrations/(?P<integration_id>[^\/]+)/serverless-functions/$",
                    OrganizationIntegrationServerlessFunctionsEndpoint.as_view(),
                    name="sentry-api-0-organization-integration-serverless-functions",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/members/$",
                    OrganizationMemberIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-member-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/external-users/$",
                    ExternalUserEndpoint.as_view(),
                    name="sentry-api-0-organization-external-user",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/external-users/(?P<external_user_id>[^\/]+)/$",
                    ExternalUserDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-external-user-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/integration-requests/$",
                    OrganizationIntegrationRequestEndpoint.as_view(),
                    name="sentry-api-0-organization-integration-request",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/invite-requests/$",
                    OrganizationInviteRequestIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-invite-request-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/invite-requests/(?P<member_id>[^\/]+)/$",
                    OrganizationInviteRequestDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-invite-request-detail",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/monitors/$",
                    OrganizationMonitorsEndpoint.as_view(),
                    name="sentry-api-0-organization-monitors",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/pinned-searches/$",
                    OrganizationPinnedSearchEndpoint.as_view(),
                    name="sentry-api-0-organization-pinned-searches",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/recent-searches/$",
                    OrganizationRecentSearchesEndpoint.as_view(),
                    name="sentry-api-0-organization-recent-searches",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/searches/(?P<search_id>[^\/]+)/$",
                    OrganizationSearchDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-search-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/searches/$",
                    OrganizationSearchesEndpoint.as_view(),
                    name="sentry-api-0-organization-searches",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/sessions/$",
                    OrganizationSessionsEndpoint.as_view(),
                    name="sentry-api-0-organization-sessions",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/users/issues/$",
                    OrganizationUserIssuesSearchEndpoint.as_view(),
                    name="sentry-api-0-organization-issue-search",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/users/(?P<user_id>[^\/]+)/issues/$",
                    OrganizationUserIssuesEndpoint.as_view(),
                    name="sentry-api-0-organization-user-issues",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/resolved/$",
                    OrganizationIssuesResolvedInReleaseEndpoint.as_view(),
                    name="sentry-api-0-organization-release-resolved",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/$",
                    OrganizationMemberDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-member-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/unreleased-commits/$",
                    OrganizationMemberUnreleasedCommitsEndpoint.as_view(),
                    name="sentry-api-0-organization-member-unreleased-commits",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/issues/assigned/$",
                    OrganizationMemberIssuesAssignedEndpoint.as_view(),
                    name="sentry-api-0-organization-member-issues-assigned",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/issues/bookmarked/$",
                    OrganizationMemberIssuesBookmarkedEndpoint.as_view(),
                    name="sentry-api-0-organization-member-issues-bookmarked",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/issues/viewed/$",
                    OrganizationMemberIssuesViewedEndpoint.as_view(),
                    name="sentry-api-0-organization-member-issues-viewed",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/teams/(?P<team_slug>[^\/]+)/$",
                    OrganizationMemberTeamDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-member-team-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/processingissues/$",
                    OrganizationProcessingIssuesEndpoint.as_view(),
                    name="sentry-api-0-organization-processing-issues",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/projects/$",
                    OrganizationProjectsEndpoint.as_view(),
                    name="sentry-api-0-organization-projects",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/projects-count/$",
                    OrganizationProjectsCountEndpoint.as_view(),
                    name="sentry-api-0-organization-projects-count",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/sent-first-event/$",
                    OrganizationProjectsSentFirstEventEndpoint.as_view(),
                    name="sentry-api-0-organization-sent-first-event",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/repos/$",
                    OrganizationRepositoriesEndpoint.as_view(),
                    name="sentry-api-0-organization-repositories",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/repos/(?P<repo_id>[^\/]+)/$",
                    OrganizationRepositoryDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-repository-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/repos/(?P<repo_id>[^\/]+)/commits/$",
                    OrganizationRepositoryCommitsEndpoint.as_view(),
                    name="sentry-api-0-organization-repository-commits",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/plugins/$",
                    OrganizationPluginsEndpoint.as_view(),
                    name="sentry-api-0-organization-plugins",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/plugins/configs/$",
                    OrganizationPluginsConfigsEndpoint.as_view(),
                    name="sentry-api-0-organization-plugins-configs",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/$",
                    OrganizationReleasesEndpoint.as_view(),
                    name="sentry-api-0-organization-releases",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/stats/$",
                    OrganizationReleasesStatsEndpoint.as_view(),
                    name="sentry-api-0-organization-releases-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/$",
                    OrganizationReleaseDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-release-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/meta/$",
                    OrganizationReleaseMetaEndpoint.as_view(),
                    name="sentry-api-0-organization-release-meta",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/assemble/$",
                    OrganizationReleaseAssembleEndpoint.as_view(),
                    name="sentry-api-0-organization-release-assemble",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/files/$",
                    OrganizationReleaseFilesEndpoint.as_view(),
                    name="sentry-api-0-organization-release-files",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/files/(?P<file_id>[^/]+)/$",
                    OrganizationReleaseFileDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-release-file-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/commitfiles/$",
                    CommitFileChangeEndpoint.as_view(),
                    name="sentry-api-0-release-commitfilechange",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/deploys/$",
                    ReleaseDeploysEndpoint.as_view(),
                    name="sentry-api-0-organization-release-deploys",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/commits/$",
                    OrganizationReleaseCommitsEndpoint.as_view(),
                    name="sentry-api-0-organization-release-commits",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/previous-with-commits/$",
                    OrganizationReleasePreviousCommitsEndpoint.as_view(),
                    name="sentry-api-0-organization-release-previous-with-commits",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/user-feedback/$",
                    OrganizationUserReportsEndpoint.as_view(),
                    name="sentry-api-0-organization-user-feedback",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/user-teams/$",
                    OrganizationUserTeamsEndpoint.as_view(),
                    name="sentry-api-0-organization-user-teams",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/users/$",
                    OrganizationUsersEndpoint.as_view(),
                    name="sentry-api-0-organization-users",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/users/(?P<user_id>[^\/]+)/$",
                    OrganizationUserDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-user-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/sentry-app-installations/$",
                    SentryAppInstallationsEndpoint.as_view(),
                    name="sentry-api-0-sentry-app-installations",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/sentry-apps/$",
                    OrganizationSentryAppsEndpoint.as_view(),
                    name="sentry-api-0-organization-sentry-apps",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/stats/$",
                    OrganizationStatsEndpoint.as_view(),
                    name="sentry-api-0-organization-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/stats_v2/$",
                    OrganizationStatsEndpointV2.as_view(),
                    name="sentry-api-0-organization-stats-v2",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/teams/$",
                    OrganizationTeamsEndpoint.as_view(),
                    name="sentry-api-0-organization-teams",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/tags/$",
                    OrganizationTagsEndpoint.as_view(),
                    name="sentry-api-0-organization-tags",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/tags/(?P<key>[^/]+)/values/$",
                    OrganizationTagKeyValuesEndpoint.as_view(),
                    name="sentry-api-0-organization-tagkey-values",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/onboarding-tasks/$",
                    OrganizationOnboardingTaskEndpoint.as_view(),
                    name="sentry-api-0-organization-onboardingtasks",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/environments/$",
                    OrganizationEnvironmentsEndpoint.as_view(),
                    name="sentry-api-0-organization-environments",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/broadcasts/$",
                    BroadcastIndexEndpoint.as_view(),
                    name="sentry-api-0-organization-broadcasts",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/join-request/$",
                    OrganizationJoinRequestEndpoint.as_view(),
                    name="sentry-api-0-organization-join-request",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/transaction-anomaly-detection/$",
                    OrganizationTransactionAnomalyDetectionEndpoint.as_view(),
                    name="sentry-api-0-organization-transaction-anomaly-detection",
                ),
                # relay usage
                url(
                    r"^(?P<organization_slug>[^\/]+)/relay_usage/$",
                    OrganizationRelayUsage.as_view(),
                    name="sentry-api-0-organization-relay-usage",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/request-project-creation/$",
                    OrganizationRequestProjectCreation.as_view(),
                    name="sentry-api-0-organization-request-project-creation",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/scim/v2/",
                    include(
                        [
                            url(
                                r"^Users$",
                                OrganizationSCIMMemberIndex.as_view(),
                                name="sentry-api-0-organization-scim-member-index",
                            ),
                            url(
                                r"^Users/(?P<member_id>\d+)$",
                                OrganizationSCIMMemberDetails.as_view(),
                                name="sentry-api-0-organization-scim-member-details",
                            ),
                            url(
                                r"^Groups$",
                                OrganizationSCIMTeamIndex.as_view(),
                                name="sentry-api-0-organization-scim-team-index",
                            ),
                            url(
                                r"^Groups/(?P<team_id>\d+)$",
                                OrganizationSCIMTeamDetails.as_view(),
                                name="sentry-api-0-organization-scim-team-details",
                            ),
                            url(
                                r"^Schemas$",
                                OrganizationSCIMSchemaIndex.as_view(),
                                name="sentry-api-0-organization-scim-schema-index",
                            ),
                        ]
                    ),
                ),
                url(
                    r"^(?P<organization_slug>[^/]+)/metrics/meta/$",
                    OrganizationMetricsEndpoint.as_view(),
                    name="sentry-api-0-organization-metrics-index",
                ),
                url(
                    r"^(?P<organization_slug>[^/]+)/metrics/meta/(?P<metric_name>[^/]+)/$",
                    OrganizationMetricDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-metric-details",
                ),
                url(
                    r"^(?P<organization_slug>[^/]+)/metrics/data/$",
                    OrganizationMetricsDataEndpoint.as_view(),
                    name="sentry-api-0-organization-metrics-data",
                ),
                url(
                    r"^(?P<organization_slug>[^/]+)/metrics/tags/$",
                    OrganizationMetricsTagsEndpoint.as_view(),
                    name="sentry-api-0-organization-metrics-tags",
                ),
                url(
                    r"^(?P<organization_slug>[^/]+)/metrics/tags/(?P<tag_name>[^/]+)/$",
                    OrganizationMetricsTagDetailsEndpoint.as_view(),
                    name="sentry-api-0-organization-metrics-tag-details",
                ),
                url(
                    r"^(?P<organization_slug>[^/]+)/profiling/",
                    include(
                        [
                            url(
                                r"^profiles/$",
                                OrganizationProfilingProfilesEndpoint.as_view(),
                                name="sentry-api-0-organization-profiling-profiles",
                            ),
                            url(
                                r"^filters/$",
                                OrganizationProfilingFiltersEndpoint.as_view(),
                                name="sentry-api-0-organization-profiling-filters",
                            ),
                        ],
                    ),
                ),
            ]
        ),
    ),
    # Toplevel app installs
    url(
        r"^sentry-app-installations/(?P<uuid>[^\/]+)/$",
        SentryAppInstallationDetailsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-details",
    ),
    url(
        r"^sentry-app-installations/(?P<uuid>[^\/]+)/external-requests/$",
        SentryAppInstallationExternalRequestsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-external-requests",
    ),
    url(
        r"^sentry-app-installations/(?P<uuid>[^\/]+)/external-issue-actions/$",
        SentryAppInstallationExternalIssueActionsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-external-issue-actions",
    ),
    url(
        r"^sentry-app-installations/(?P<uuid>[^\/]+)/external-issues/$",
        SentryAppInstallationExternalIssuesEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-external-issues",
    ),
    url(
        r"^sentry-app-installations/(?P<uuid>[^\/]+)/external-issues/(?P<external_issue_id>[^\/]+)/$",
        SentryAppInstallationExternalIssueDetailsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-external-issue-details",
    ),
    # Teams
    url(
        r"^teams/",
        include(
            [
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/$",
                    TeamDetailsEndpoint.as_view(),
                    name="sentry-api-0-team-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/issues/old/$",
                    TeamGroupsOldEndpoint.as_view(),
                    name="sentry-api-0-team-oldest-issues",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/release-count/$",
                    TeamReleaseCountEndpoint.as_view(),
                    name="sentry-api-0-team-release-count",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/time-to-resolution/$",
                    TeamTimeToResolutionEndpoint.as_view(),
                    name="sentry-api-0-team-time-to-resolution",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/unresolved-issue-age/$",
                    TeamUnresolvedIssueAgeEndpoint.as_view(),
                    name="sentry-api-0-team-unresolved-issue-age",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/alerts-triggered/$",
                    TeamAlertsTriggeredTotalsEndpoint.as_view(),
                    name="sentry-api-0-team-alerts-triggered",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/alerts-triggered-index/$",
                    TeamAlertsTriggeredIndexEndpoint.as_view(),
                    name="sentry-api-0-team-alerts-triggered-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/issue-breakdown/$",
                    TeamIssueBreakdownEndpoint.as_view(),
                    name="sentry-api-0-team-issue-breakdown",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/all-unresolved-issues/$",
                    TeamAllUnresolvedIssuesEndpoint.as_view(),
                    name="sentry-api-0-team-all-unresolved-issues",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/notification-settings/$",
                    TeamNotificationSettingsDetailsEndpoint.as_view(),
                    name="sentry-api-0-team-notification-settings",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/members/$",
                    TeamMembersEndpoint.as_view(),
                    name="sentry-api-0-team-members",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/projects/$",
                    TeamProjectsEndpoint.as_view(),
                    name="sentry-api-0-team-project-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/stats/$",
                    TeamStatsEndpoint.as_view(),
                    name="sentry-api-0-team-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/avatar/$",
                    TeamAvatarEndpoint.as_view(),
                    name="sentry-api-0-team-avatar",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/external-teams/$",
                    ExternalTeamEndpoint.as_view(),
                    name="sentry-api-0-external-team",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/external-teams/(?P<external_team_id>[^\/]+)/$",
                    ExternalTeamDetailsEndpoint.as_view(),
                    name="sentry-api-0-external-team-details",
                ),
            ]
        ),
    ),
    # Projects
    url(
        r"^projects/",
        include(
            [
                url(
                    r"^(?P<organization_slug>[^\/]+)/rule-conditions/$",
                    ProjectAgnosticRuleConditionsEndpoint.as_view(),
                    name="sentry-api-0-project-agnostic-rule-conditions",
                ),
                url(r"^$", ProjectIndexEndpoint.as_view(), name="sentry-api-0-projects"),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/$",
                    ProjectDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/alert-rules/(?P<alert_rule_id>[^\/]+)/$",
                    ProjectAlertRuleDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-alert-rule-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/alert-rules/$",
                    ProjectAlertRuleIndexEndpoint.as_view(),
                    name="sentry-api-0-project-alert-rules",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/alert-rule-task/(?P<task_uuid>[^\/]+)/$",
                    ProjectAlertRuleTaskDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-alert-rule-task-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/combined-rules/$",
                    ProjectCombinedRuleIndexEndpoint.as_view(),
                    name="sentry-api-0-project-combined-rules",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/avatar/$",
                    ProjectAvatarEndpoint.as_view(),
                    name="sentry-api-0-project-avatar",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/create-sample/$",
                    ProjectCreateSampleEndpoint.as_view(),
                    name="sentry-api-0-project-create-sample",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/create-sample-transaction/$",
                    ProjectCreateSampleTransactionEndpoint.as_view(),
                    name="sentry-api-0-project-create-sample-transaction",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/docs/(?P<platform>[\w-]+)/$",
                    ProjectDocsPlatformEndpoint.as_view(),
                    name="sentry-api-0-project-docs-platform",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/environments/$",
                    ProjectEnvironmentsEndpoint.as_view(),
                    name="sentry-api-0-project-environments",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/environments/(?P<environment>[^/]+)/$",
                    ProjectEnvironmentDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-environment-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/platforms/$",
                    ProjectPlatformsEndpoint.as_view(),
                    name="sentry-api-0-project-platform-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/$",
                    ProjectEventsEndpoint.as_view(),
                    name="sentry-api-0-project-events",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>(?:\d+|[A-Fa-f0-9]{32}))/$",
                    ProjectEventDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-event-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/grouping-info/$",
                    EventGroupingInfoEndpoint.as_view(),
                    name="sentry-api-0-event-grouping-info",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/apple-crash-report$",
                    EventAppleCrashReportEndpoint.as_view(),
                    name="sentry-api-0-event-apple-crash-report",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/attachments/$",
                    EventAttachmentsEndpoint.as_view(),
                    name="sentry-api-0-event-attachments",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/reprocessable/$",
                    EventReprocessableEndpoint.as_view(),
                    name="sentry-api-0-event-attachments",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/attachments/(?P<attachment_id>[\w-]+)/$",
                    EventAttachmentDetailsEndpoint.as_view(),
                    name="sentry-api-0-event-attachment-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/committers/$",
                    EventFileCommittersEndpoint.as_view(),
                    name="sentry-api-0-event-file-committers",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/json/$",
                    EventJsonEndpoint.as_view(),
                    name="sentry-api-0-event-json",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/owners/$",
                    EventOwnersEndpoint.as_view(),
                    name="sentry-api-0-event-owners",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/files/dsyms/$",
                    DebugFilesEndpoint.as_view(),
                    name="sentry-api-0-dsym-files",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/files/source-maps/$",
                    SourceMapsEndpoint.as_view(),
                    name="sentry-api-0-source-maps",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/files/difs/assemble/$",
                    DifAssembleEndpoint.as_view(),
                    name="sentry-api-0-assemble-dif-files",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/files/dsyms/unknown/$",
                    UnknownDebugFilesEndpoint.as_view(),
                    name="sentry-api-0-unknown-dsym-files",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/files/dsyms/associate/$",
                    AssociateDSymFilesEndpoint.as_view(),
                    name="sentry-api-0-associate-dsym-files",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/filters/$",
                    ProjectFiltersEndpoint.as_view(),
                    name="sentry-api-0-project-filters",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/filters/(?P<filter_id>[\w-]+)/$",
                    ProjectFilterDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-filters",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/hooks/$",
                    ProjectServiceHooksEndpoint.as_view(),
                    name="sentry-api-0-service-hooks",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/hooks/(?P<hook_id>[^\/]+)/$",
                    ProjectServiceHookDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-service-hook-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/hooks/(?P<hook_id>[^\/]+)/stats/$",
                    ProjectServiceHookStatsEndpoint.as_view(),
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/(?:issues|groups)/$",
                    ProjectGroupIndexEndpoint.as_view(),
                    name="sentry-api-0-project-group-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/(?:issues|groups)/stats/$",
                    ProjectGroupStatsEndpoint.as_view(),
                    name="sentry-api-0-project-group-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/keys/$",
                    ProjectKeysEndpoint.as_view(),
                    name="sentry-api-0-project-keys",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/keys/(?P<key_id>[^\/]+)/$",
                    ProjectKeyDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-key-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/keys/(?P<key_id>[^\/]+)/stats/$",
                    ProjectKeyStatsEndpoint.as_view(),
                ),
                url(
                    r"^(?P<organization_slug>[^/]+)/(?P<project_slug>[^/]+)/members/$",
                    ProjectMemberIndexEndpoint.as_view(),
                    name="sentry-api-0-project-member-index",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/$",
                    ProjectReleasesEndpoint.as_view(),
                    name="sentry-api-0-project-releases",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/token/$",
                    ProjectReleasesTokenEndpoint.as_view(),
                    name="sentry-api-0-project-releases-token",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/completion/$",
                    ProjectReleaseSetupCompletionEndpoint.as_view(),
                    name="sentry-api-0-project-releases-completion-status",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/$",
                    ProjectReleaseDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-release-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/commits/$",
                    ProjectReleaseCommitsEndpoint.as_view(),
                    name="sentry-api-0-project-release-commits",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/repositories/$",
                    ProjectReleaseRepositories.as_view(),
                    name="sentry-api-0-project-release-repositories",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/resolved/$",
                    ProjectIssuesResolvedInReleaseEndpoint.as_view(),
                    name="sentry-api-0-project-release-resolved",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/stats/$",
                    ProjectReleaseStatsEndpoint.as_view(),
                    name="sentry-api-0-project-release-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/files/$",
                    ProjectReleaseFilesEndpoint.as_view(),
                    name="sentry-api-0-project-release-files",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/files/(?P<file_id>[^/]+)/$",
                    ProjectReleaseFileDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-release-file-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/rules/$",
                    ProjectRulesEndpoint.as_view(),
                    name="sentry-api-0-project-rules",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/rules/configuration/$",
                    ProjectRulesConfigurationEndpoint.as_view(),
                    name="sentry-api-0-project-rules-configuration",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/rules/(?P<rule_id>[^\/]+)/$",
                    ProjectRuleDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-rule-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/rule-task/(?P<task_uuid>[^\/]+)/$",
                    ProjectRuleTaskDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-rule-task-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/searches/$",
                    ProjectSearchesEndpoint.as_view(),
                    name="sentry-api-0-project-searches",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/searches/(?P<search_id>[^\/]+)/$",
                    ProjectSearchDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-search-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/stats/$",
                    ProjectStatsEndpoint.as_view(),
                    name="sentry-api-0-project-stats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tags/$",
                    ProjectTagsEndpoint.as_view(),
                    name="sentry-api-0-project-tags",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tags/(?P<key>[^/]+)/$",
                    ProjectTagKeyDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-tagkey-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tags/(?P<key>[^/]+)/values/$",
                    ProjectTagKeyValuesEndpoint.as_view(),
                    name="sentry-api-0-project-tagkey-values",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/teams/$",
                    ProjectTeamsEndpoint.as_view(),
                    name="sentry-api-0-project-teams",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/teams/(?P<team_slug>[^\/]+)/$",
                    ProjectTeamDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-team-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/transfer/$",
                    ProjectTransferEndpoint.as_view(),
                    name="sentry-api-0-project-transfer",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/users/$",
                    ProjectUsersEndpoint.as_view(),
                    name="sentry-api-0-project-users",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/users/(?P<user_hash>[^/]+)/$",
                    ProjectUserDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-user-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/(?:user-feedback|user-reports)/$",
                    ProjectUserReportsEndpoint.as_view(),
                    name="sentry-api-0-project-user-reports",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/user-stats/$",
                    ProjectUserStatsEndpoint.as_view(),
                    name="sentry-api-0-project-userstats",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/processingissues/$",
                    ProjectProcessingIssuesEndpoint.as_view(),
                    name="sentry-api-0-project-processing-issues",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/processingissues/fix$",
                    ProjectProcessingIssuesFixEndpoint.as_view(),
                    name="sentry-api-0-project-fix-processing-issues",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/reprocessing/$",
                    ProjectReprocessingEndpoint.as_view(),
                    name="sentry-api-0-project-reprocessing",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/processingissues/discard/$",
                    ProjectProcessingIssuesDiscardEndpoint.as_view(),
                    name="sentry-api-0-project-discard-processing-issues",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/ownership/$",
                    ProjectOwnershipEndpoint.as_view(),
                    name="sentry-api-0-project-ownership",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/codeowners/$",
                    ProjectCodeOwnersEndpoint.as_view(),
                    name="sentry-api-0-project-codeowners",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/codeowners/(?P<codeowners_id>[^\/]+)/$",
                    ProjectCodeOwnersDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-codeowners-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/codeowners-request/$",
                    ProjectCodeOwnersRequestEndpoint.as_view(),
                    name="getsentry-api-0-project-codeowners-request",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/transaction-threshold/configure/$",
                    ProjectTransactionThresholdEndpoint.as_view(),
                    name="sentry-api-0-project-transaction-threshold",
                ),
                # Load plugin project urls
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/plugins/$",
                    ProjectPluginsEndpoint.as_view(),
                    name="sentry-api-0-project-plugins",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/plugins/(?P<plugin_id>[^\/]+)/$",
                    ProjectPluginDetailsEndpoint.as_view(),
                    name="sentry-api-0-project-plugin-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/plugins?/",
                    include("sentry.plugins.base.project_api_urls"),
                ),
                # Tombstone
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tombstones/$",
                    GroupTombstoneEndpoint.as_view(),
                    name="sentry-api-0-group-tombstones",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tombstones/(?P<tombstone_id>\d+)/$",
                    GroupTombstoneDetailsEndpoint.as_view(),
                    name="sentry-api-0-group-tombstone-details",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/stacktrace-link/$",
                    ProjectStacktraceLinkEndpoint.as_view(),
                    name="sentry-api-0-project-stacktrace-link",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/repo-path-parsing/$",
                    ProjectRepoPathParsingEndpoint.as_view(),
                    name="sentry-api-0-project-repo-path-parsing",
                ),
                # Grouping configs
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/grouping-configs/$",
                    ProjectGroupingConfigsEndpoint.as_view(),
                    name="sentry-api-0-project-grouping-configs",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/appstoreconnect/$",
                    AppStoreConnectCreateCredentialsEndpoint.as_view(),
                    name="sentry-api-0-project-appstoreconnect-credentials-create",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/appstoreconnect/apps/$",
                    AppStoreConnectAppsEndpoint.as_view(),
                    name="sentry-api-0-project-appstoreconnect-apps",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/appstoreconnect/status/$",
                    AppStoreConnectStatusEndpoint.as_view(),
                    name="sentry-api-0-project-appstoreconnect-status",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/appstoreconnect/(?P<credentials_id>[^\/]+)/$",
                    AppStoreConnectUpdateCredentialsEndpoint.as_view(),
                    name="sentry-api-0-project-appstoreconnect-credentials-update",
                ),
                url(
                    r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/profiling/profiles/(?P<transaction_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
                    ProjectProfilingProfileEndpoint.as_view(),
                    name="sentry-api-0-project-profiling-profile",
                ),
            ]
        ),
    ),
    # Groups
    url(r"^(?:issues|groups)/", include(GROUP_URLS)),
    url(
        r"^issues/(?P<issue_id>[^\/]+)/participants/$",
        GroupParticipantsEndpoint.as_view(),
        name="sentry-api-0-group-stats",
    ),
    url(
        r"^shared/(?:issues|groups)/(?P<share_id>[^\/]+)/$",
        SharedGroupDetailsEndpoint.as_view(),
        name="sentry-api-0-shared-group-details",
    ),
    # Sentry Apps
    url(r"^sentry-apps/$", SentryAppsEndpoint.as_view(), name="sentry-api-0-sentry-apps"),
    url(
        r"^sentry-apps-stats/$",
        SentryAppsStatsEndpoint.as_view(),
        name="sentry-api-0-sentry-apps-stats",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/$",
        SentryAppDetailsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-details",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/features/$",
        SentryAppFeaturesEndpoint.as_view(),
        name="sentry-api-0-sentry-app-features",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/components/$",
        SentryAppComponentsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-components",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/avatar/$",
        SentryAppAvatarEndpoint.as_view(),
        name="sentry-api-0-sentry-app-avatar",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/api-tokens/$",
        SentryInternalAppTokensEndpoint.as_view(),
        name="sentry-api-0-sentry-internal-app-tokens",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/api-tokens/(?P<api_token>[^\/]+)/$",
        SentryInternalAppTokenDetailsEndpoint.as_view(),
        name="sentry-api-0-sentry-internal-app-token-details",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/stats/$",
        SentryAppStatsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-stats",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/requests/$",
        SentryAppRequestsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-requests",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/interaction/$",
        SentryAppInteractionEndpoint.as_view(),
        name="sentry-api-0-sentry-app-interaction",
    ),
    url(
        r"^organizations/(?P<organization_slug>[^\/]+)/sentry-app-components/$",
        OrganizationSentryAppComponentsEndpoint.as_view(),
        name="sentry-api-0-org-sentry-app-components",
    ),
    url(
        r"^sentry-app-installations/(?P<uuid>[^\/]+)/authorizations/$",
        SentryAppAuthorizationsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-authorizations",
    ),
    url(
        r"^sentry-apps/(?P<sentry_app_slug>[^\/]+)/publish-request/$",
        SentryAppPublishRequestEndpoint.as_view(),
        name="sentry-api-0-sentry-app-publish-request",
    ),
    # Document Integrations
    url(
        r"^doc-integrations/$",
        DocIntegrationsEndpoint.as_view(),
        name="sentry-api-0-doc-integrations",
    ),
    url(
        r"^doc-integrations/(?P<doc_integration_slug>[^\/]+)/$",
        DocIntegrationDetailsEndpoint.as_view(),
        name="sentry-api-0-doc-integration-details",
    ),
    url(
        r"^doc-integrations/(?P<doc_integration_slug>[^\/]+)/avatar/$",
        DocIntegrationAvatarEndpoint.as_view(),
        name="sentry-api-0-doc-integration-avatar",
    ),
    # Integration Features
    url(
        r"^integration-features/$",
        IntegrationFeaturesEndpoint.as_view(),
        name="sentry-api-0-integration-features",
    ),
    # Grouping configs
    url(
        r"^grouping-configs/$",
        GroupingConfigsEndpoint.as_view(),
        name="sentry-api-0-grouping-configs",
    ),
    # Symbolicator Builtin Sources
    url(
        r"^builtin-symbol-sources/$",
        BuiltinSymbolSourcesEndpoint.as_view(),
        name="sentry-api-0-builtin-symbol-sources",
    ),
    # Internal
    url(
        r"^internal/",
        include(
            [
                url(
                    r"^health/$", SystemHealthEndpoint.as_view(), name="sentry-api-0-system-health"
                ),
                url(
                    r"^options/$",
                    SystemOptionsEndpoint.as_view(),
                    name="sentry-api-0-system-options",
                ),
                url(
                    r"^beacon/$",
                    InternalBeaconEndpoint.as_view(),
                    name="sentry-api-0-internal-beacon",
                ),
                url(r"^quotas/$", InternalQuotasEndpoint.as_view()),
                url(r"^queue/tasks/$", InternalQueueTasksEndpoint.as_view()),
                url(r"^stats/$", InternalStatsEndpoint.as_view()),
                url(r"^warnings/$", InternalWarningsEndpoint.as_view()),
                url(r"^packages/$", InternalPackagesEndpoint.as_view()),
                url(r"^environment/$", InternalEnvironmentEndpoint.as_view()),
                url(r"^mail/$", InternalMailEndpoint.as_view()),
            ]
        ),
    ),
    # Project Wizard
    url(r"^wizard/$", SetupWizard.as_view(), name="sentry-api-0-project-wizard-new"),
    url(
        r"^wizard/(?P<wizard_hash>[^\/]+)/$",
        SetupWizard.as_view(),
        name="sentry-api-0-project-wizard",
    ),
    # Catch all
    url(r"^$", IndexEndpoint.as_view(), name="sentry-api-index"),
    url(r"^", CatchallEndpoint.as_view(), name="sentry-api-catchall"),
    # url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework'))
]
