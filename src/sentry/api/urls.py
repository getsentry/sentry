from __future__ import annotations

from django.conf.urls import include
from django.urls import URLPattern, URLResolver, re_path

from sentry.api.endpoints.organization_ai_conversations import OrganizationAIConversationsEndpoint
from sentry.api.endpoints.organization_auth_token_details import (
    OrganizationAuthTokenDetailsEndpoint,
)
from sentry.api.endpoints.organization_auth_tokens import OrganizationAuthTokensEndpoint
from sentry.api.endpoints.organization_events_root_cause_analysis import (
    OrganizationEventsRootCauseAnalysisEndpoint,
)
from sentry.api.endpoints.organization_fork import OrganizationForkEndpoint
from sentry.api.endpoints.organization_insights_tree import OrganizationInsightsTreeEndpoint
from sentry.api.endpoints.organization_missing_org_members import OrganizationMissingMembersEndpoint
from sentry.api.endpoints.organization_plugin_deprecation_info import (
    OrganizationPluginDeprecationInfoEndpoint,
)
from sentry.api.endpoints.organization_plugins_configs import OrganizationPluginsConfigsEndpoint
from sentry.api.endpoints.organization_plugins_index import OrganizationPluginsEndpoint
from sentry.api.endpoints.organization_project_keys import OrganizationProjectKeysEndpoint
from sentry.api.endpoints.organization_releases import (
    OrganizationReleasesEndpoint,
    OrganizationReleasesStatsEndpoint,
)
from sentry.api.endpoints.organization_sampling_admin_metrics import (
    OrganizationDynamicSamplingAdminMetricsEndpoint,
)
from sentry.api.endpoints.organization_sampling_effective_sample_rate import (
    OrganizationSamplingEffectiveSampleRateEndpoint,
)
from sentry.api.endpoints.organization_sampling_project_span_counts import (
    OrganizationSamplingProjectSpanCountsEndpoint,
)
from sentry.api.endpoints.organization_stats_summary import OrganizationStatsSummaryEndpoint
from sentry.api.endpoints.organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpoint,
    OrganizationTraceItemAttributeValuesEndpoint,
)
from sentry.api.endpoints.organization_trace_item_attributes_ranked import (
    OrganizationTraceItemsAttributesRankedEndpoint,
)
from sentry.api.endpoints.organization_trace_item_stats import OrganizationTraceItemsStatsEndpoint
from sentry.api.endpoints.organization_unsubscribe import (
    OrganizationUnsubscribeIssue,
    OrganizationUnsubscribeProject,
)
from sentry.api.endpoints.project_overview import ProjectOverviewEndpoint
from sentry.api.endpoints.project_stacktrace_coverage import ProjectStacktraceCoverageEndpoint
from sentry.api.endpoints.project_statistical_detectors import ProjectStatisticalDetectors
from sentry.api.endpoints.project_template_detail import OrganizationProjectTemplateDetailEndpoint
from sentry.api.endpoints.project_templates_index import OrganizationProjectTemplatesIndexEndpoint
from sentry.api.endpoints.project_web_vitals_detection import ProjectWebVitalsDetectionEndpoint
from sentry.api.endpoints.release_thresholds.release_threshold import ReleaseThresholdEndpoint
from sentry.api.endpoints.release_thresholds.release_threshold_details import (
    ReleaseThresholdDetailsEndpoint,
)
from sentry.api.endpoints.release_thresholds.release_threshold_index import (
    ReleaseThresholdIndexEndpoint,
)
from sentry.api.endpoints.release_thresholds.release_threshold_status_index import (
    ReleaseThresholdStatusIndexEndpoint,
)
from sentry.api.endpoints.secret_scanning.github import SecretScanningGitHubEndpoint
from sentry.api.endpoints.source_map_debug_blue_thunder_edition import (
    SourceMapDebugBlueThunderEditionEndpoint,
)
from sentry.auth_v2.urls import AUTH_V2_URLS
from sentry.codecov.endpoints.branches.branches import RepositoryBranchesEndpoint
from sentry.codecov.endpoints.repositories.repositories import RepositoriesEndpoint
from sentry.codecov.endpoints.repository.repository import RepositoryEndpoint
from sentry.codecov.endpoints.repository_token_regenerate.repository_token_regenerate import (
    RepositoryTokenRegenerateEndpoint,
)
from sentry.codecov.endpoints.repository_tokens.repository_tokens import RepositoryTokensEndpoint
from sentry.codecov.endpoints.sync_repos.sync_repos import SyncReposEndpoint
from sentry.codecov.endpoints.test_results.test_results import TestResultsEndpoint
from sentry.codecov.endpoints.test_results_aggregates.test_results_aggregates import (
    TestResultsAggregatesEndpoint,
)
from sentry.codecov.endpoints.test_suites.test_suites import TestSuitesEndpoint
from sentry.conduit.endpoints.organization_conduit_demo import OrganizationConduitDemoEndpoint
from sentry.core.endpoints.organization_auditlogs import OrganizationAuditLogsEndpoint
from sentry.core.endpoints.organization_avatar import OrganizationAvatarEndpoint
from sentry.core.endpoints.organization_details import OrganizationDetailsEndpoint
from sentry.core.endpoints.organization_environments import OrganizationEnvironmentsEndpoint
from sentry.core.endpoints.organization_index import OrganizationIndexEndpoint
from sentry.core.endpoints.organization_member_details import OrganizationMemberDetailsEndpoint
from sentry.core.endpoints.organization_member_index import OrganizationMemberIndexEndpoint
from sentry.core.endpoints.organization_member_invite.details import (
    OrganizationMemberInviteDetailsEndpoint,
)
from sentry.core.endpoints.organization_member_invite.index import (
    OrganizationMemberInviteIndexEndpoint,
)
from sentry.core.endpoints.organization_member_invite.reinvite import (
    OrganizationMemberReinviteEndpoint,
)
from sentry.core.endpoints.organization_member_requests_invite_details import (
    OrganizationInviteRequestDetailsEndpoint,
)
from sentry.core.endpoints.organization_member_requests_invite_index import (
    OrganizationInviteRequestIndexEndpoint,
)
from sentry.core.endpoints.organization_member_requests_join import OrganizationJoinRequestEndpoint
from sentry.core.endpoints.organization_member_team_details import (
    OrganizationMemberTeamDetailsEndpoint,
)
from sentry.core.endpoints.organization_projects import (
    OrganizationProjectsCountEndpoint,
    OrganizationProjectsEndpoint,
)
from sentry.core.endpoints.organization_projects_experiment import (
    OrganizationProjectsExperimentEndpoint,
)
from sentry.core.endpoints.organization_region import OrganizationRegionEndpoint
from sentry.core.endpoints.organization_request_project_creation import (
    OrganizationRequestProjectCreation,
)
from sentry.core.endpoints.organization_teams import OrganizationTeamsEndpoint
from sentry.core.endpoints.organization_user_details import OrganizationUserDetailsEndpoint
from sentry.core.endpoints.organization_user_teams import OrganizationUserTeamsEndpoint
from sentry.core.endpoints.organization_users import OrganizationUsersEndpoint
from sentry.core.endpoints.project_details import ProjectDetailsEndpoint
from sentry.core.endpoints.project_environment_details import ProjectEnvironmentDetailsEndpoint
from sentry.core.endpoints.project_environments import ProjectEnvironmentsEndpoint
from sentry.core.endpoints.project_index import ProjectIndexEndpoint
from sentry.core.endpoints.project_key_details import ProjectKeyDetailsEndpoint
from sentry.core.endpoints.project_key_stats import ProjectKeyStatsEndpoint
from sentry.core.endpoints.project_keys import ProjectKeysEndpoint
from sentry.core.endpoints.project_stats import ProjectStatsEndpoint
from sentry.core.endpoints.project_team_details import ProjectTeamDetailsEndpoint
from sentry.core.endpoints.project_teams import ProjectTeamsEndpoint
from sentry.core.endpoints.project_transfer import ProjectTransferEndpoint
from sentry.core.endpoints.project_users import ProjectUsersEndpoint
from sentry.core.endpoints.scim.members import (
    OrganizationSCIMMemberDetails,
    OrganizationSCIMMemberIndex,
)
from sentry.core.endpoints.scim.schemas import OrganizationSCIMSchemaIndex
from sentry.core.endpoints.scim.teams import OrganizationSCIMTeamDetails, OrganizationSCIMTeamIndex
from sentry.core.endpoints.team_details import TeamDetailsEndpoint
from sentry.core.endpoints.team_members import TeamMembersEndpoint
from sentry.core.endpoints.team_projects import TeamProjectsEndpoint
from sentry.core.endpoints.team_release_count import TeamReleaseCountEndpoint
from sentry.core.endpoints.team_stats import TeamStatsEndpoint
from sentry.core.endpoints.team_time_to_resolution import TeamTimeToResolutionEndpoint
from sentry.core.endpoints.team_unresolved_issue_age import TeamUnresolvedIssueAgeEndpoint
from sentry.dashboards.endpoints.organization_dashboard_details import (
    OrganizationDashboardDetailsEndpoint,
    OrganizationDashboardFavoriteEndpoint,
    OrganizationDashboardVisitEndpoint,
)
from sentry.dashboards.endpoints.organization_dashboard_widget_details import (
    OrganizationDashboardWidgetDetailsEndpoint,
)
from sentry.dashboards.endpoints.organization_dashboards import OrganizationDashboardsEndpoint
from sentry.dashboards.endpoints.organization_dashboards_starred import (
    OrganizationDashboardsStarredEndpoint,
    OrganizationDashboardsStarredOrderEndpoint,
)
from sentry.data_export.endpoints.data_export import DataExportEndpoint
from sentry.data_export.endpoints.data_export_details import DataExportDetailsEndpoint
from sentry.discover.endpoints.discover_homepage_query import DiscoverHomepageQueryEndpoint
from sentry.discover.endpoints.discover_key_transactions import (
    KeyTransactionEndpoint,
    KeyTransactionListEndpoint,
)
from sentry.discover.endpoints.discover_saved_queries import DiscoverSavedQueriesEndpoint
from sentry.discover.endpoints.discover_saved_query_detail import (
    DiscoverSavedQueryDetailEndpoint,
    DiscoverSavedQueryVisitEndpoint,
)
from sentry.explore.endpoints.explore_saved_queries import ExploreSavedQueriesEndpoint
from sentry.explore.endpoints.explore_saved_query_detail import (
    ExploreSavedQueryDetailEndpoint,
    ExploreSavedQueryVisitEndpoint,
)
from sentry.explore.endpoints.explore_saved_query_starred import ExploreSavedQueryStarredEndpoint
from sentry.explore.endpoints.explore_saved_query_starred_order import (
    ExploreSavedQueryStarredOrderEndpoint,
)
from sentry.feedback.endpoints.organization_feedback_categories import (
    OrganizationFeedbackCategoriesEndpoint,
)
from sentry.feedback.endpoints.organization_feedback_summary import (
    OrganizationFeedbackSummaryEndpoint,
)
from sentry.feedback.endpoints.organization_user_reports import OrganizationUserReportsEndpoint
from sentry.feedback.endpoints.project_user_reports import ProjectUserReportsEndpoint
from sentry.flags.endpoints.hooks import OrganizationFlagsHooksEndpoint
from sentry.flags.endpoints.logs import (
    OrganizationFlagLogDetailsEndpoint,
    OrganizationFlagLogIndexEndpoint,
)
from sentry.flags.endpoints.secrets import (
    OrganizationFlagsWebHookSigningSecretEndpoint,
    OrganizationFlagsWebHookSigningSecretsEndpoint,
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
    OrganizationOnDemandRuleStatsEndpoint,
)
from sentry.incidents.endpoints.organization_incident_details import (
    OrganizationIncidentDetailsEndpoint,
)
from sentry.incidents.endpoints.organization_incident_index import OrganizationIncidentIndexEndpoint
from sentry.incidents.endpoints.project_alert_rule_details import ProjectAlertRuleDetailsEndpoint
from sentry.incidents.endpoints.project_alert_rule_index import ProjectAlertRuleIndexEndpoint
from sentry.incidents.endpoints.project_alert_rule_task_details import (
    ProjectAlertRuleTaskDetailsEndpoint,
)
from sentry.incidents.endpoints.team_alerts_triggered import (
    TeamAlertsTriggeredIndexEndpoint,
    TeamAlertsTriggeredTotalsEndpoint,
)
from sentry.insights.endpoints.starred_segments import InsightsStarredSegmentsEndpoint
from sentry.integrations.api.endpoints.data_forwarding_details import DataForwardingDetailsEndpoint
from sentry.integrations.api.endpoints.data_forwarding_index import DataForwardingIndexEndpoint
from sentry.integrations.api.endpoints.doc_integration_avatar import DocIntegrationAvatarEndpoint
from sentry.integrations.api.endpoints.doc_integration_details import DocIntegrationDetailsEndpoint
from sentry.integrations.api.endpoints.doc_integrations_index import DocIntegrationsEndpoint
from sentry.integrations.api.endpoints.external_team_details import ExternalTeamDetailsEndpoint
from sentry.integrations.api.endpoints.external_team_index import ExternalTeamEndpoint
from sentry.integrations.api.endpoints.external_user_details import ExternalUserDetailsEndpoint
from sentry.integrations.api.endpoints.external_user_index import ExternalUserEndpoint
from sentry.integrations.api.endpoints.integration_features import IntegrationFeaturesEndpoint
from sentry.integrations.api.endpoints.integration_proxy import InternalIntegrationProxyEndpoint
from sentry.integrations.api.endpoints.organization_code_mapping_codeowners import (
    OrganizationCodeMappingCodeOwnersEndpoint,
)
from sentry.integrations.api.endpoints.organization_code_mapping_details import (
    OrganizationCodeMappingDetailsEndpoint,
)
from sentry.integrations.api.endpoints.organization_code_mappings import (
    OrganizationCodeMappingsEndpoint,
)
from sentry.integrations.api.endpoints.organization_coding_agents import (
    OrganizationCodingAgentsEndpoint,
)
from sentry.integrations.api.endpoints.organization_config_integrations import (
    OrganizationConfigIntegrationsEndpoint,
)
from sentry.integrations.api.endpoints.organization_integration_channel_validate import (
    OrganizationIntegrationChannelValidateEndpoint,
)
from sentry.integrations.api.endpoints.organization_integration_channels import (
    OrganizationIntegrationChannelsEndpoint,
)
from sentry.integrations.api.endpoints.organization_integration_details import (
    OrganizationIntegrationDetailsEndpoint,
)
from sentry.integrations.api.endpoints.organization_integration_issues import (
    OrganizationIntegrationIssuesEndpoint,
)
from sentry.integrations.api.endpoints.organization_integration_migrate_opsgenie import (
    OrganizationIntegrationMigrateOpsgenieEndpoint,
)
from sentry.integrations.api.endpoints.organization_integration_repos import (
    OrganizationIntegrationReposEndpoint,
)
from sentry.integrations.api.endpoints.organization_integration_request import (
    OrganizationIntegrationRequestEndpoint,
)
from sentry.integrations.api.endpoints.organization_integration_serverless_functions import (
    OrganizationIntegrationServerlessFunctionsEndpoint,
)
from sentry.integrations.api.endpoints.organization_integrations_index import (
    OrganizationIntegrationsEndpoint,
)
from sentry.integrations.api.endpoints.organization_repositories import (
    OrganizationRepositoriesEndpoint,
)
from sentry.integrations.api.endpoints.organization_repository_commits import (
    OrganizationRepositoryCommitsEndpoint,
)
from sentry.integrations.api.endpoints.organization_repository_details import (
    OrganizationRepositoryDetailsEndpoint,
)
from sentry.integrations.api.endpoints.organization_repository_settings import (
    OrganizationRepositorySettingsEndpoint,
)
from sentry.issues.endpoints import (
    ActionableItemsEndpoint,
    EventIdLookupEndpoint,
    EventJsonEndpoint,
    GroupActivitiesEndpoint,
    GroupDetailsEndpoint,
    GroupEventDetailsEndpoint,
    GroupEventsEndpoint,
    GroupHashesEndpoint,
    GroupNotesDetailsEndpoint,
    GroupNotesEndpoint,
    GroupSimilarIssuesEmbeddingsEndpoint,
    GroupSimilarIssuesEndpoint,
    GroupTombstoneDetailsEndpoint,
    GroupTombstoneEndpoint,
    OrganizationDeriveCodeMappingsEndpoint,
    OrganizationGroupIndexEndpoint,
    OrganizationGroupIndexStatsEndpoint,
    OrganizationGroupSearchViewDetailsEndpoint,
    OrganizationGroupSearchViewDetailsStarredEndpoint,
    OrganizationGroupSearchViewsEndpoint,
    OrganizationGroupSearchViewsStarredEndpoint,
    OrganizationGroupSearchViewVisitEndpoint,
    OrganizationIssuesCountEndpoint,
    OrganizationReleasePreviousCommitsEndpoint,
    OrganizationSearchesEndpoint,
    ProjectEventDetailsEndpoint,
    ProjectEventsEndpoint,
    ProjectGroupIndexEndpoint,
    ProjectGroupStatsEndpoint,
    ProjectStacktraceLinkEndpoint,
    RelatedIssuesEndpoint,
    SharedGroupDetailsEndpoint,
    ShortIdLookupEndpoint,
    SourceMapDebugEndpoint,
    TeamGroupsOldEndpoint,
)
from sentry.issues.endpoints.event_grouping_info import EventGroupingInfoEndpoint
from sentry.issues.endpoints.event_owners import EventOwnersEndpoint
from sentry.issues.endpoints.event_reprocessable import EventReprocessableEndpoint
from sentry.issues.endpoints.group_attachments import GroupAttachmentsEndpoint
from sentry.issues.endpoints.group_current_release import GroupCurrentReleaseEndpoint
from sentry.issues.endpoints.group_first_last_release import GroupFirstLastReleaseEndpoint
from sentry.issues.endpoints.group_integration_details import GroupIntegrationDetailsEndpoint
from sentry.issues.endpoints.group_integrations import GroupIntegrationsEndpoint
from sentry.issues.endpoints.group_reprocessing import GroupReprocessingEndpoint
from sentry.issues.endpoints.group_stats import GroupStatsEndpoint
from sentry.issues.endpoints.group_tagkey_details import GroupTagKeyDetailsEndpoint
from sentry.issues.endpoints.group_tagkey_values import GroupTagKeyValuesEndpoint
from sentry.issues.endpoints.group_tags import GroupTagsEndpoint
from sentry.issues.endpoints.group_user_reports import GroupUserReportsEndpoint
from sentry.issues.endpoints.organization_codeowners_associations import (
    OrganizationCodeOwnersAssociationsEndpoint,
)
from sentry.issues.endpoints.organization_event_details import OrganizationEventDetailsEndpoint
from sentry.issues.endpoints.organization_group_search_view_starred_order import (
    OrganizationGroupSearchViewStarredOrderEndpoint,
)
from sentry.issues.endpoints.organization_group_suspect_flags import (
    OrganizationGroupSuspectFlagsEndpoint,
)
from sentry.issues.endpoints.organization_group_suspect_tags import (
    OrganizationGroupSuspectTagsEndpoint,
)
from sentry.issues.endpoints.organization_issue_metrics import OrganizationIssueMetricsEndpoint
from sentry.issues.endpoints.organization_issue_timeseries import (
    OrganizationIssueTimeSeriesEndpoint,
)
from sentry.issues.endpoints.organization_issues_resolved_in_release import (
    OrganizationIssuesResolvedInReleaseEndpoint,
)
from sentry.issues.endpoints.project_codeowners_details import ProjectCodeOwnersDetailsEndpoint
from sentry.issues.endpoints.project_codeowners_index import ProjectCodeOwnersEndpoint
from sentry.issues.endpoints.project_grouping_configs import ProjectGroupingConfigsEndpoint
from sentry.issues.endpoints.project_issues_resolved_in_release import (
    ProjectIssuesResolvedInReleaseEndpoint,
)
from sentry.issues.endpoints.project_ownership import ProjectOwnershipEndpoint
from sentry.issues.endpoints.project_performance_issue_settings import (
    ProjectPerformanceIssueSettingsEndpoint,
)
from sentry.issues.endpoints.project_user_issue import ProjectUserIssueEndpoint
from sentry.issues.endpoints.team_all_unresolved_issues import TeamAllUnresolvedIssuesEndpoint
from sentry.issues.endpoints.team_issue_breakdown import TeamIssueBreakdownEndpoint
from sentry.monitors.endpoints.organization_monitor_checkin_index import (
    OrganizationMonitorCheckInIndexEndpoint,
)
from sentry.monitors.endpoints.organization_monitor_details import (
    OrganizationMonitorDetailsEndpoint,
)
from sentry.monitors.endpoints.organization_monitor_environment_details import (
    OrganizationMonitorEnvironmentDetailsEndpoint,
)
from sentry.monitors.endpoints.organization_monitor_index import OrganizationMonitorIndexEndpoint
from sentry.monitors.endpoints.organization_monitor_index_count import (
    OrganizationMonitorIndexCountEndpoint,
)
from sentry.monitors.endpoints.organization_monitor_index_stats import (
    OrganizationMonitorIndexStatsEndpoint,
)
from sentry.monitors.endpoints.organization_monitor_processing_errors_index import (
    OrganizationMonitorProcessingErrorsIndexEndpoint,
)
from sentry.monitors.endpoints.organization_monitor_schedule_sample_data import (
    OrganizationMonitorScheduleSampleDataEndpoint,
)
from sentry.monitors.endpoints.organization_monitor_stats import OrganizationMonitorStatsEndpoint
from sentry.monitors.endpoints.project_monitor_checkin_index import (
    ProjectMonitorCheckInIndexEndpoint,
)
from sentry.monitors.endpoints.project_monitor_details import ProjectMonitorDetailsEndpoint
from sentry.monitors.endpoints.project_monitor_environment_details import (
    ProjectMonitorEnvironmentDetailsEndpoint,
)
from sentry.monitors.endpoints.project_monitor_processing_errors_index import (
    ProjectMonitorProcessingErrorsIndexEndpoint,
)
from sentry.monitors.endpoints.project_monitor_stats import ProjectMonitorStatsEndpoint
from sentry.monitors.endpoints.project_processing_errors_details import (
    ProjectProcessingErrorsDetailsEndpoint,
)
from sentry.monitors.endpoints.project_processing_errors_index import (
    ProjectProcessingErrorsIndexEndpoint,
)
from sentry.notifications.api.endpoints.notification_actions_available import (
    NotificationActionsAvailableEndpoint,
)
from sentry.notifications.api.endpoints.notification_actions_details import (
    NotificationActionsDetailsEndpoint,
)
from sentry.notifications.api.endpoints.notification_actions_index import (
    NotificationActionsIndexEndpoint,
)
from sentry.notifications.api.endpoints.notification_defaults import NotificationDefaultsEndpoints
from sentry.notifications.api.endpoints.user_notification_details import (
    UserNotificationDetailsEndpoint,
)
from sentry.notifications.api.endpoints.user_notification_email import UserNotificationEmailEndpoint
from sentry.notifications.api.endpoints.user_notification_settings_options import (
    UserNotificationSettingsOptionsEndpoint,
)
from sentry.notifications.api.endpoints.user_notification_settings_options_detail import (
    UserNotificationSettingsOptionsDetailEndpoint,
)
from sentry.notifications.api.endpoints.user_notification_settings_providers import (
    UserNotificationSettingsProvidersEndpoint,
)
from sentry.notifications.platform.api.endpoints import urls as notification_platform_urls
from sentry.objectstore.endpoints.organization import OrganizationObjectstoreEndpoint
from sentry.overwatch.endpoints.overwatch_rpc import (
    CodeReviewRepoSettingsEndpoint,
    PreventPrReviewEligibilityEndpoint,
    PreventPrReviewResolvedConfigsEndpoint,
    PreventPrReviewSentryOrgEndpoint,
)
from sentry.preprod.api.endpoints import urls as preprod_urls
from sentry.prevent.endpoints.organization_github_repos import (
    OrganizationPreventGitHubReposEndpoint,
)
from sentry.prevent.endpoints.pr_review_github_config import OrganizationPreventGitHubConfigEndpoint
from sentry.releases.endpoints.organization_release_assemble import (
    OrganizationReleaseAssembleEndpoint,
)
from sentry.releases.endpoints.organization_release_commits import (
    OrganizationReleaseCommitsEndpoint,
)
from sentry.releases.endpoints.organization_release_details import (
    OrganizationReleaseDetailsEndpoint,
)
from sentry.releases.endpoints.organization_release_file_details import (
    OrganizationReleaseFileDetailsEndpoint,
)
from sentry.releases.endpoints.organization_release_files import OrganizationReleaseFilesEndpoint
from sentry.releases.endpoints.organization_release_health_data import (
    OrganizationReleaseHealthDataEndpoint,
)
from sentry.releases.endpoints.organization_release_meta import OrganizationReleaseMetaEndpoint
from sentry.releases.endpoints.project_release_commits import ProjectReleaseCommitsEndpoint
from sentry.releases.endpoints.project_release_details import ProjectReleaseDetailsEndpoint
from sentry.releases.endpoints.project_release_file_details import ProjectReleaseFileDetailsEndpoint
from sentry.releases.endpoints.project_release_files import ProjectReleaseFilesEndpoint
from sentry.releases.endpoints.project_release_repositories import ProjectReleaseRepositories
from sentry.releases.endpoints.project_release_setup import ProjectReleaseSetupCompletionEndpoint
from sentry.releases.endpoints.project_release_stats import ProjectReleaseStatsEndpoint
from sentry.releases.endpoints.project_releases import ProjectReleasesEndpoint
from sentry.releases.endpoints.project_releases_token import ProjectReleasesTokenEndpoint
from sentry.releases.endpoints.release_deploys import ReleaseDeploysEndpoint
from sentry.relocation.api.endpoints.abort import RelocationAbortEndpoint
from sentry.relocation.api.endpoints.artifacts.details import RelocationArtifactDetailsEndpoint
from sentry.relocation.api.endpoints.artifacts.index import RelocationArtifactIndexEndpoint
from sentry.relocation.api.endpoints.cancel import RelocationCancelEndpoint
from sentry.relocation.api.endpoints.details import RelocationDetailsEndpoint
from sentry.relocation.api.endpoints.index import RelocationIndexEndpoint
from sentry.relocation.api.endpoints.pause import RelocationPauseEndpoint
from sentry.relocation.api.endpoints.public_key import RelocationPublicKeyEndpoint
from sentry.relocation.api.endpoints.recover import RelocationRecoverEndpoint
from sentry.relocation.api.endpoints.retry import RelocationRetryEndpoint
from sentry.relocation.api.endpoints.unpause import RelocationUnpauseEndpoint
from sentry.replays.endpoints.data_export_notifications import DataExportNotificationsEndpoint
from sentry.replays.endpoints.organization_replay_count import OrganizationReplayCountEndpoint
from sentry.replays.endpoints.organization_replay_details import OrganizationReplayDetailsEndpoint
from sentry.replays.endpoints.organization_replay_events_meta import (
    OrganizationReplayEventsMetaEndpoint,
)
from sentry.replays.endpoints.organization_replay_index import OrganizationReplayIndexEndpoint
from sentry.replays.endpoints.organization_replay_selector_index import (
    OrganizationReplaySelectorIndexEndpoint,
)
from sentry.replays.endpoints.project_replay_clicks_index import ProjectReplayClicksIndexEndpoint
from sentry.replays.endpoints.project_replay_details import ProjectReplayDetailsEndpoint
from sentry.replays.endpoints.project_replay_jobs_delete import (
    ProjectReplayDeletionJobDetailEndpoint,
    ProjectReplayDeletionJobsIndexEndpoint,
)
from sentry.replays.endpoints.project_replay_recording_segment_details import (
    ProjectReplayRecordingSegmentDetailsEndpoint,
)
from sentry.replays.endpoints.project_replay_recording_segment_index import (
    ProjectReplayRecordingSegmentIndexEndpoint,
)
from sentry.replays.endpoints.project_replay_summary import ProjectReplaySummaryEndpoint
from sentry.replays.endpoints.project_replay_video_details import ProjectReplayVideoDetailsEndpoint
from sentry.replays.endpoints.project_replay_viewed_by import ProjectReplayViewedByEndpoint
from sentry.rules.history.endpoints.project_rule_group_history import (
    ProjectRuleGroupHistoryIndexEndpoint,
)
from sentry.rules.history.endpoints.project_rule_stats import ProjectRuleStatsIndexEndpoint
from sentry.seer.endpoints.group_ai_autofix import GroupAutofixEndpoint
from sentry.seer.endpoints.group_ai_summary import GroupAiSummaryEndpoint
from sentry.seer.endpoints.group_autofix_setup_check import GroupAutofixSetupCheck
from sentry.seer.endpoints.group_autofix_update import GroupAutofixUpdateEndpoint
from sentry.seer.endpoints.organization_autofix_automation_settings import (
    OrganizationAutofixAutomationSettingsEndpoint,
)
from sentry.seer.endpoints.organization_events_anomalies import OrganizationEventsAnomaliesEndpoint
from sentry.seer.endpoints.organization_seer_explorer_chat import (
    OrganizationSeerExplorerChatEndpoint,
)
from sentry.seer.endpoints.organization_seer_explorer_runs import (
    OrganizationSeerExplorerRunsEndpoint,
)
from sentry.seer.endpoints.organization_seer_explorer_update import (
    OrganizationSeerExplorerUpdateEndpoint,
)
from sentry.seer.endpoints.organization_seer_onboarding_check import OrganizationSeerOnboardingCheck
from sentry.seer.endpoints.organization_seer_rpc import OrganizationSeerRpcEndpoint
from sentry.seer.endpoints.organization_seer_setup_check import OrganizationSeerSetupCheckEndpoint
from sentry.seer.endpoints.organization_trace_summary import OrganizationTraceSummaryEndpoint
from sentry.seer.endpoints.project_seer_preferences import ProjectSeerPreferencesEndpoint
from sentry.seer.endpoints.seer_rpc import SeerRpcServiceEndpoint
from sentry.seer.endpoints.trace_explorer_ai_query import TraceExplorerAIQuery
from sentry.seer.endpoints.trace_explorer_ai_setup import TraceExplorerAISetup
from sentry.seer.endpoints.trace_explorer_ai_translate_agentic import SearchAgentTranslateEndpoint
from sentry.sentry_apps.api.endpoints.group_external_issue_details import (
    GroupExternalIssueDetailsEndpoint,
)
from sentry.sentry_apps.api.endpoints.group_external_issues import GroupExternalIssuesEndpoint
from sentry.sentry_apps.api.endpoints.installation_details import (
    SentryAppInstallationDetailsEndpoint,
)
from sentry.sentry_apps.api.endpoints.installation_external_issue_actions import (
    SentryAppInstallationExternalIssueActionsEndpoint,
)
from sentry.sentry_apps.api.endpoints.installation_external_issue_details import (
    SentryAppInstallationExternalIssueDetailsEndpoint,
)
from sentry.sentry_apps.api.endpoints.installation_external_issues import (
    SentryAppInstallationExternalIssuesEndpoint,
)
from sentry.sentry_apps.api.endpoints.installation_external_requests import (
    SentryAppInstallationExternalRequestsEndpoint,
)
from sentry.sentry_apps.api.endpoints.installation_service_hook_projects import (
    SentryAppInstallationServiceHookProjectsEndpoint,
)
from sentry.sentry_apps.api.endpoints.organization_sentry_apps import OrganizationSentryAppsEndpoint
from sentry.sentry_apps.api.endpoints.sentry_app_authorizations import (
    SentryAppAuthorizationsEndpoint,
)
from sentry.sentry_apps.api.endpoints.sentry_app_avatar import SentryAppAvatarEndpoint
from sentry.sentry_apps.api.endpoints.sentry_app_components import (
    OrganizationSentryAppComponentsEndpoint,
    SentryAppComponentsEndpoint,
)
from sentry.sentry_apps.api.endpoints.sentry_app_details import SentryAppDetailsEndpoint
from sentry.sentry_apps.api.endpoints.sentry_app_features import SentryAppFeaturesEndpoint
from sentry.sentry_apps.api.endpoints.sentry_app_installations import SentryAppInstallationsEndpoint
from sentry.sentry_apps.api.endpoints.sentry_app_interaction import SentryAppInteractionEndpoint
from sentry.sentry_apps.api.endpoints.sentry_app_publish_request import (
    SentryAppPublishRequestEndpoint,
)
from sentry.sentry_apps.api.endpoints.sentry_app_rotate_secret import SentryAppRotateSecretEndpoint
from sentry.sentry_apps.api.endpoints.sentry_app_stats_details import SentryAppStatsEndpoint
from sentry.sentry_apps.api.endpoints.sentry_app_webhook_requests import (
    SentryAppWebhookRequestsEndpoint,
)
from sentry.sentry_apps.api.endpoints.sentry_apps import SentryAppsEndpoint
from sentry.sentry_apps.api.endpoints.sentry_apps_stats import SentryAppsStatsEndpoint
from sentry.sentry_apps.api.endpoints.sentry_internal_app_token_details import (
    SentryInternalAppTokenDetailsEndpoint,
)
from sentry.sentry_apps.api.endpoints.sentry_internal_app_tokens import (
    SentryInternalAppTokensEndpoint,
)
from sentry.tempest.endpoints.tempest_credentials import TempestCredentialsEndpoint
from sentry.tempest.endpoints.tempest_credentials_details import TempestCredentialsDetailsEndpoint
from sentry.tempest.endpoints.tempest_ips import TempestIpsEndpoint
from sentry.uptime.endpoints.organiation_uptime_alert_index import (
    OrganizationUptimeAlertIndexEndpoint,
)
from sentry.uptime.endpoints.organization_uptime_alert_index_count import (
    OrganizationUptimeAlertIndexCountEndpoint,
)
from sentry.uptime.endpoints.organization_uptime_stats import OrganizationUptimeStatsEndpoint
from sentry.uptime.endpoints.organization_uptime_summary import OrganizationUptimeSummaryEndpoint
from sentry.uptime.endpoints.project_uptime_alert_checks_index import (
    ProjectUptimeAlertCheckIndexEndpoint,
)
from sentry.uptime.endpoints.project_uptime_alert_details import ProjectUptimeAlertDetailsEndpoint
from sentry.uptime.endpoints.project_uptime_alert_index import ProjectUptimeAlertIndexEndpoint
from sentry.uptime.endpoints.uptime_ips import UptimeIpsEndpoint
from sentry.users.api.endpoints.authenticator_index import AuthenticatorIndexEndpoint
from sentry.users.api.endpoints.user_authenticator_details import UserAuthenticatorDetailsEndpoint
from sentry.users.api.endpoints.user_authenticator_enroll import UserAuthenticatorEnrollEndpoint
from sentry.users.api.endpoints.user_authenticator_index import UserAuthenticatorIndexEndpoint
from sentry.users.api.endpoints.user_avatar import UserAvatarEndpoint
from sentry.users.api.endpoints.user_details import UserDetailsEndpoint
from sentry.users.api.endpoints.user_emails import UserEmailsEndpoint
from sentry.users.api.endpoints.user_emails_confirm import UserEmailsConfirmEndpoint
from sentry.users.api.endpoints.user_identity import UserIdentityEndpoint
from sentry.users.api.endpoints.user_identity_config import (
    UserIdentityConfigDetailsEndpoint,
    UserIdentityConfigEndpoint,
)
from sentry.users.api.endpoints.user_identity_details import UserIdentityDetailsEndpoint
from sentry.users.api.endpoints.user_index import UserIndexEndpoint
from sentry.users.api.endpoints.user_ips import UserIPsEndpoint
from sentry.users.api.endpoints.user_password import UserPasswordEndpoint
from sentry.users.api.endpoints.user_permission_details import UserPermissionDetailsEndpoint
from sentry.users.api.endpoints.user_permissions import UserPermissionsEndpoint
from sentry.users.api.endpoints.user_permissions_config import UserPermissionsConfigEndpoint
from sentry.users.api.endpoints.user_regions import UserRegionsEndpoint
from sentry.users.api.endpoints.user_role_details import UserUserRoleDetailsEndpoint
from sentry.users.api.endpoints.user_roles import UserUserRolesEndpoint
from sentry.users.api.endpoints.userroles_details import UserRoleDetailsEndpoint
from sentry.users.api.endpoints.userroles_index import UserRolesEndpoint
from sentry.workflow_engine.endpoints import urls as workflow_urls

from .endpoints.accept_organization_invite import AcceptOrganizationInvite
from .endpoints.accept_project_transfer import AcceptProjectTransferEndpoint
from .endpoints.admin_project_configs import AdminRelayProjectConfigsEndpoint
from .endpoints.api_application_details import ApiApplicationDetailsEndpoint
from .endpoints.api_application_rotate_secret import ApiApplicationRotateSecretEndpoint
from .endpoints.api_applications import ApiApplicationsEndpoint
from .endpoints.api_authorizations import ApiAuthorizationsEndpoint
from .endpoints.api_token_details import ApiTokenDetailsEndpoint
from .endpoints.api_tokens import ApiTokensEndpoint
from .endpoints.artifact_bundles import ArtifactBundlesEndpoint
from .endpoints.artifact_lookup import ProjectArtifactLookupEndpoint
from .endpoints.assistant import AssistantEndpoint
from .endpoints.auth_config import AuthConfigEndpoint
from .endpoints.auth_index import AuthIndexEndpoint
from .endpoints.auth_login import AuthLoginEndpoint
from .endpoints.auth_validate import AuthValidateEndpoint
from .endpoints.broadcast_details import BroadcastDetailsEndpoint
from .endpoints.broadcast_index import BroadcastIndexEndpoint
from .endpoints.builtin_symbol_sources import BuiltinSymbolSourcesEndpoint
from .endpoints.catchall import CatchallEndpoint
from .endpoints.chunk import ChunkUploadEndpoint
from .endpoints.custom_rules import CustomRulesEndpoint
from .endpoints.data_scrubbing_selector_suggestions import DataScrubbingSelectorSuggestionsEndpoint
from .endpoints.debug_files import (
    AssociateDSymFilesEndpoint,
    DebugFilesEndpoint,
    DifAssembleEndpoint,
    ProguardArtifactReleasesEndpoint,
    SourceMapsEndpoint,
    UnknownDebugFilesEndpoint,
)
from .endpoints.email_capture import EmailCaptureEndpoint
from .endpoints.event_apple_crash_report import EventAppleCrashReportEndpoint
from .endpoints.event_attachment_details import EventAttachmentDetailsEndpoint
from .endpoints.event_attachments import EventAttachmentsEndpoint
from .endpoints.event_file_committers import EventFileCommittersEndpoint
from .endpoints.filechange import CommitFileChangeEndpoint
from .endpoints.frontend_version import FrontendVersionEndpoint
from .endpoints.index import IndexEndpoint
from .endpoints.internal import (
    InternalBeaconEndpoint,
    InternalEnvironmentEndpoint,
    InternalFeatureFlagsEndpoint,
    InternalMailEndpoint,
    InternalPackagesEndpoint,
    InternalRpcServiceEndpoint,
    InternalWarningsEndpoint,
)
from .endpoints.internal_ea_features import InternalEAFeaturesEndpoint
from .endpoints.organization_access_request_details import OrganizationAccessRequestDetailsEndpoint
from .endpoints.organization_api_key_details import OrganizationApiKeyDetailsEndpoint
from .endpoints.organization_api_key_index import OrganizationApiKeyIndexEndpoint
from .endpoints.organization_artifactbundle_assemble import (
    OrganizationArtifactBundleAssembleEndpoint,
)
from .endpoints.organization_auth_provider_details import OrganizationAuthProviderDetailsEndpoint
from .endpoints.organization_auth_providers import OrganizationAuthProvidersEndpoint
from .endpoints.organization_config_repositories import OrganizationConfigRepositoriesEndpoint
from .endpoints.organization_events import OrganizationEventsEndpoint
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
    OrganizationSpansSamplesEndpoint,
)
from .endpoints.organization_events_span_ops import OrganizationEventsSpanOpsEndpoint
from .endpoints.organization_events_spans_histogram import OrganizationEventsSpansHistogramEndpoint
from .endpoints.organization_events_spans_performance import (
    OrganizationEventsSpansExamplesEndpoint,
    OrganizationEventsSpansPerformanceEndpoint,
    OrganizationEventsSpansStatsEndpoint,
)
from .endpoints.organization_events_stats import OrganizationEventsStatsEndpoint
from .endpoints.organization_events_timeseries import OrganizationEventsTimeseriesEndpoint
from .endpoints.organization_events_trace import (
    OrganizationEventsTraceEndpoint,
    OrganizationEventsTraceLightEndpoint,
    OrganizationEventsTraceMetaEndpoint,
)
from .endpoints.organization_events_trends import (
    OrganizationEventsTrendsEndpoint,
    OrganizationEventsTrendsStatsEndpoint,
)
from .endpoints.organization_events_trends_v2 import OrganizationEventsNewTrendsStatsEndpoint
from .endpoints.organization_events_vitals import OrganizationEventsVitalsEndpoint
from .endpoints.organization_measurements_meta import OrganizationMeasurementsMeta
from .endpoints.organization_metrics_meta import (
    OrganizationMetricsCompatibility,
    OrganizationMetricsCompatibilitySums,
)
from .endpoints.organization_on_demand_metrics_estimation_stats import (
    OrganizationOnDemandMetricsEstimationStatsEndpoint,
)
from .endpoints.organization_onboarding_continuation_email import (
    OrganizationOnboardingContinuationEmail,
)
from .endpoints.organization_onboarding_tasks import OrganizationOnboardingTaskEndpoint
from .endpoints.organization_pinned_searches import OrganizationPinnedSearchEndpoint
from .endpoints.organization_profiling_functions import OrganizationProfilingFunctionTrendsEndpoint
from .endpoints.organization_profiling_profiles import (
    OrganizationProfilingChunksEndpoint,
    OrganizationProfilingFlamegraphEndpoint,
    OrganizationProfilingHasChunksEndpoint,
)
from .endpoints.organization_projects_sent_first_event import (
    OrganizationProjectsSentFirstEventEndpoint,
)
from .endpoints.organization_recent_searches import OrganizationRecentSearchesEndpoint
from .endpoints.organization_relay_usage import OrganizationRelayUsage
from .endpoints.organization_sampling_project_rates import OrganizationSamplingProjectRatesEndpoint
from .endpoints.organization_sdk_deprecations import OrganizationSdkDeprecationsEndpoint
from .endpoints.organization_sdk_updates import (
    OrganizationSdksEndpoint,
    OrganizationSdkUpdatesEndpoint,
)
from .endpoints.organization_search_details import OrganizationSearchDetailsEndpoint
from .endpoints.organization_sessions import OrganizationSessionsEndpoint
from .endpoints.organization_spans_fields import (
    OrganizationSpansFieldsEndpoint,
    OrganizationSpansFieldValuesEndpoint,
)
from .endpoints.organization_spans_fields_stats import OrganizationSpansFieldsStatsEndpoint
from .endpoints.organization_stats import OrganizationStatsEndpoint
from .endpoints.organization_stats_v2 import OrganizationStatsEndpointV2
from .endpoints.organization_tagkey_values import OrganizationTagKeyValuesEndpoint
from .endpoints.organization_tags import OrganizationTagsEndpoint
from .endpoints.organization_trace import OrganizationTraceEndpoint
from .endpoints.organization_trace_logs import OrganizationTraceLogsEndpoint
from .endpoints.organization_trace_meta import OrganizationTraceMetaEndpoint
from .endpoints.organization_traces import OrganizationTracesEndpoint
from .endpoints.project_artifact_bundle_file_details import ProjectArtifactBundleFileDetailsEndpoint
from .endpoints.project_artifact_bundle_files import ProjectArtifactBundleFilesEndpoint
from .endpoints.project_commits import ProjectCommitsEndpoint
from .endpoints.project_create_sample import ProjectCreateSampleEndpoint
from .endpoints.project_create_sample_transaction import ProjectCreateSampleTransactionEndpoint
from .endpoints.project_filter_details import ProjectFilterDetailsEndpoint
from .endpoints.project_filters import ProjectFiltersEndpoint
from .endpoints.project_member_index import ProjectMemberIndexEndpoint
from .endpoints.project_performance_general_settings import (
    ProjectPerformanceGeneralSettingsEndpoint,
)
from .endpoints.project_plugin_details import ProjectPluginDetailsEndpoint
from .endpoints.project_plugins import ProjectPluginsEndpoint
from .endpoints.project_profiling_profile import (
    ProjectProfilingProfileEndpoint,
    ProjectProfilingRawChunkEndpoint,
    ProjectProfilingRawProfileEndpoint,
)
from .endpoints.project_repo_path_parsing import ProjectRepoPathParsingEndpoint
from .endpoints.project_reprocessing import ProjectReprocessingEndpoint
from .endpoints.project_rule_actions import ProjectRuleActionsEndpoint
from .endpoints.project_rule_details import ProjectRuleDetailsEndpoint
from .endpoints.project_rule_enable import ProjectRuleEnableEndpoint
from .endpoints.project_rule_preview import ProjectRulePreviewEndpoint
from .endpoints.project_rule_task_details import ProjectRuleTaskDetailsEndpoint
from .endpoints.project_rules import ProjectRulesEndpoint
from .endpoints.project_rules_configuration import ProjectRulesConfigurationEndpoint
from .endpoints.project_servicehook_details import ProjectServiceHookDetailsEndpoint
from .endpoints.project_servicehook_stats import ProjectServiceHookStatsEndpoint
from .endpoints.project_servicehooks import ProjectServiceHooksEndpoint
from .endpoints.project_symbol_sources import ProjectSymbolSourcesEndpoint
from .endpoints.project_tagkey_details import ProjectTagKeyDetailsEndpoint
from .endpoints.project_tagkey_values import ProjectTagKeyValuesEndpoint
from .endpoints.project_tags import ProjectTagsEndpoint
from .endpoints.project_trace_item_details import ProjectTraceItemDetailsEndpoint
from .endpoints.project_transaction_names import ProjectTransactionNamesCluster
from .endpoints.project_transaction_threshold import ProjectTransactionThresholdEndpoint
from .endpoints.project_transaction_threshold_override import (
    ProjectTransactionThresholdOverrideEndpoint,
)
from .endpoints.project_user_stats import ProjectUserStatsEndpoint
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
from .endpoints.rule_snooze import MetricRuleSnoozeEndpoint, RuleSnoozeEndpoint
from .endpoints.seer_models import SeerModelsEndpoint
from .endpoints.setup_wizard import SetupWizard
from .endpoints.system_health import SystemHealthEndpoint
from .endpoints.system_options import SystemOptionsEndpoint
from .endpoints.user_organizationintegrations import UserOrganizationIntegrationsEndpoint
from .endpoints.user_organizations import UserOrganizationsEndpoint
from .endpoints.user_subscriptions import UserSubscriptionsEndpoint

__all__ = ("urlpatterns",)


# issues endpoints are available both top level (by numerical ID) as well as coupled
# to the organization (and queryable via short ID)


# NOTE: Start adding to ISSUES_URLS instead of here because (?:issues|groups)
# cannot be reversed and we prefer to always use issues instead of groups
def create_group_urls(name_prefix: str) -> list[URLPattern | URLResolver]:
    return [
        re_path(
            r"^(?P<issue_id>[^/]+)/$",
            GroupDetailsEndpoint.as_view(),
            name=f"{name_prefix}-group-details",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/activities/$",
            GroupActivitiesEndpoint.as_view(),
            name=f"{name_prefix}-group-activities",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/events/$",
            GroupEventsEndpoint.as_view(),
            name=f"{name_prefix}-group-events",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/events/(?P<event_id>(?:latest|oldest|recommended|\d+|[A-Fa-f0-9-]{32,36}))/$",
            GroupEventDetailsEndpoint.as_view(),
            name=f"{name_prefix}-group-event-details",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/(?:notes|comments)/$",
            GroupNotesEndpoint.as_view(),
            name=f"{name_prefix}-group-notes",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/(?:notes|comments)/(?P<note_id>[^/]+)/$",
            GroupNotesDetailsEndpoint.as_view(),
            name=f"{name_prefix}-group-note-details",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/hashes/$",
            GroupHashesEndpoint.as_view(),
            name=f"{name_prefix}-group-hashes",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/reprocessing/$",
            GroupReprocessingEndpoint.as_view(),
            name=f"{name_prefix}-group-reprocessing",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/stats/$",
            GroupStatsEndpoint.as_view(),
            name=f"{name_prefix}-group-stats",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/tags/$",
            GroupTagsEndpoint.as_view(),
            name=f"{name_prefix}-group-tags",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/tags/(?P<key>[^/]+)/$",
            GroupTagKeyDetailsEndpoint.as_view(),
            name=f"{name_prefix}-group-tag-key-details",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/tags/(?P<key>[^/]+)/values/$",
            GroupTagKeyValuesEndpoint.as_view(),
            name=f"{name_prefix}-group-tag-key-values",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/suspect/flags/$",
            OrganizationGroupSuspectFlagsEndpoint.as_view(),
            name=f"{name_prefix}-suspect-flags",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/suspect/tags/$",
            OrganizationGroupSuspectTagsEndpoint.as_view(),
            name=f"{name_prefix}-suspect-tags",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/(?:user-feedback|user-reports)/$",
            GroupUserReportsEndpoint.as_view(),
            name=f"{name_prefix}-group-user-reports",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/attachments/$",
            GroupAttachmentsEndpoint.as_view(),
            name=f"{name_prefix}-group-attachments",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/similar/$",
            GroupSimilarIssuesEndpoint.as_view(),
            name=f"{name_prefix}-group-similar",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/similar-issues-embeddings/$",
            GroupSimilarIssuesEmbeddingsEndpoint.as_view(),
            name=f"{name_prefix}-group-similar-issues-embeddings",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/external-issues/$",
            GroupExternalIssuesEndpoint.as_view(),
            name=f"{name_prefix}-group-external-issues",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/external-issues/(?P<external_issue_id>\d+)/$",
            GroupExternalIssueDetailsEndpoint.as_view(),
            name=f"{name_prefix}-group-external-issues-details",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/integrations/$",
            GroupIntegrationsEndpoint.as_view(),
            name=f"{name_prefix}-group-integrations",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/integrations/(?P<integration_id>\d+)/$",
            GroupIntegrationDetailsEndpoint.as_view(),
            name=f"{name_prefix}-group-integration-details",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/current-release/$",
            GroupCurrentReleaseEndpoint.as_view(),
            name=f"{name_prefix}-group-current-release",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/first-last-release/$",
            GroupFirstLastReleaseEndpoint.as_view(),
            name=f"{name_prefix}-group-first-last-release",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/autofix/$",
            GroupAutofixEndpoint.as_view(),
            name=f"{name_prefix}-group-autofix",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/autofix/update/$",
            GroupAutofixUpdateEndpoint.as_view(),
            name=f"{name_prefix}-group-autofix-update",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/autofix/setup/$",
            GroupAutofixSetupCheck.as_view(),
            name=f"{name_prefix}-group-autofix-setup",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/summarize/$",
            GroupAiSummaryEndpoint.as_view(),
            name=f"{name_prefix}-group-ai-summary",
        ),
        re_path(
            r"^(?P<issue_id>[^/]+)/related-issues/$",
            RelatedIssuesEndpoint.as_view(),
            name=f"{name_prefix}-related-issues",
        ),
        # Load plugin group urls
        re_path(
            r"^(?P<issue_id>[^/]+)/plugins?/",
            include("sentry.plugins.base.group_api_urls"),
        ),
    ]


AUTH_URLS = [
    re_path(
        r"^$",
        AuthIndexEndpoint.as_view(),
        name="sentry-api-0-auth",
    ),
    re_path(
        r"^config/$",
        AuthConfigEndpoint.as_view(),
        name="sentry-api-0-auth-config",
    ),
    re_path(
        r"^login/$",
        AuthLoginEndpoint.as_view(),
        name="sentry-api-0-auth-login",
    ),
    re_path(
        r"^validate/$",
        AuthValidateEndpoint.as_view(),
        name="sentry-api-0-auth-test",
    ),
]

BROADCAST_URLS = [
    re_path(
        r"^$",
        BroadcastIndexEndpoint.as_view(),
        name="sentry-api-0-broadcast-index",
    ),
    re_path(
        r"^(?P<broadcast_id>[^/]+)/$",
        BroadcastDetailsEndpoint.as_view(),
        name="sentry-api-0-broadcast-details",
    ),
]

RELOCATION_URLS = [
    re_path(
        r"^$",
        RelocationIndexEndpoint.as_view(),
        name="sentry-api-0-relocations-index",
    ),
    re_path(
        r"^(?P<relocation_uuid>[^/]+)/$",
        RelocationDetailsEndpoint.as_view(),
        name="sentry-api-0-relocations-details",
    ),
    re_path(
        r"^(?P<relocation_uuid>[^/]+)/abort/$",
        RelocationAbortEndpoint.as_view(),
        name="sentry-api-0-relocations-abort",
    ),
    re_path(
        r"^(?P<relocation_uuid>[^/]+)/cancel/$",
        RelocationCancelEndpoint.as_view(),
        name="sentry-api-0-relocations-cancel",
    ),
    re_path(
        r"^(?P<relocation_uuid>[^/]+)/pause/$",
        RelocationPauseEndpoint.as_view(),
        name="sentry-api-0-relocations-pause",
    ),
    re_path(
        r"^(?P<relocation_uuid>[^/]+)/recover/$",
        RelocationRecoverEndpoint.as_view(),
        name="sentry-api-0-relocations-recover",
    ),
    re_path(
        r"^(?P<relocation_uuid>[^/]+)/retry/$",
        RelocationRetryEndpoint.as_view(),
        name="sentry-api-0-relocations-retry",
    ),
    re_path(
        r"^(?P<relocation_uuid>[^/]+)/unpause/$",
        RelocationUnpauseEndpoint.as_view(),
        name="sentry-api-0-relocations-unpause",
    ),
    re_path(
        r"^(?P<relocation_uuid>[^/]+)/artifacts/$",
        RelocationArtifactIndexEndpoint.as_view(),
        name="sentry-api-0-relocations-artifacts-index",
    ),
    re_path(
        r"^(?P<relocation_uuid>[^/]+)/artifacts/(?P<artifact_kind>[^/]+)/(?P<file_name>[^/]+)$",
        RelocationArtifactDetailsEndpoint.as_view(),
        name="sentry-api-0-relocations-artifacts-details",
    ),
]

RELAY_URLS = [
    re_path(
        r"^$",
        RelayIndexEndpoint.as_view(),
        name="sentry-api-0-relays-index",
    ),
    re_path(
        r"^register/challenge/$",
        RelayRegisterChallengeEndpoint.as_view(),
        name="sentry-api-0-relay-register-challenge",
    ),
    re_path(
        r"^register/response/$",
        RelayRegisterResponseEndpoint.as_view(),
        name="sentry-api-0-relay-register-response",
    ),
    re_path(
        r"^projectconfigs/$",
        RelayProjectConfigsEndpoint.as_view(),
        name="sentry-api-0-relay-projectconfigs",
    ),
    re_path(
        r"^projectids/$",
        RelayProjectIdsEndpoint.as_view(),
        name="sentry-api-0-relay-projectids",
    ),
    re_path(
        r"^publickeys/$",
        RelayPublicKeysEndpoint.as_view(),
        name="sentry-api-0-relay-publickeys",
    ),
    re_path(
        r"^live/$",
        RelayHealthCheck.as_view(),
        name="sentry-api-0-relays-healthcheck",
    ),
    re_path(
        r"^(?P<relay_id>[^/]+)/$",
        RelayDetailsEndpoint.as_view(),
        name="sentry-api-0-relays-details",
    ),
]

PREVENT_URLS = [
    re_path(
        r"^owner/(?P<owner>[^/]+)/repository/(?P<repository>[^/]+)/test-results/$",
        TestResultsEndpoint.as_view(),
        name="sentry-api-0-test-results",
    ),
    re_path(
        r"^owner/(?P<owner>[^/]+)/repository/(?P<repository>[^/]+)/test-suites/$",
        TestSuitesEndpoint.as_view(),
        name="sentry-api-0-test-suites",
    ),
    re_path(
        r"^owner/(?P<owner>[^/]+)/repository/(?P<repository>[^/]+)/test-results-aggregates/$",
        TestResultsAggregatesEndpoint.as_view(),
        name="sentry-api-0-test-results-aggregates",
    ),
    re_path(
        r"^owner/(?P<owner>[^/]+)/repository/(?P<repository>[^/]+)/branches/$",
        RepositoryBranchesEndpoint.as_view(),
        name="sentry-api-0-repository-branches",
    ),
    re_path(
        r"^owner/(?P<owner>[^/]+)/repository/(?P<repository>[^/]+)/$",
        RepositoryEndpoint.as_view(),
        name="sentry-api-0-repository",
    ),
    re_path(
        r"^owner/(?P<owner>[^/]+)/repositories/$",
        RepositoriesEndpoint.as_view(),
        name="sentry-api-0-repositories",
    ),
    re_path(
        r"^owner/(?P<owner>[^/]+)/repositories/tokens/$",
        RepositoryTokensEndpoint.as_view(),
        name="sentry-api-0-repository-tokens",
    ),
    re_path(
        r"^owner/(?P<owner>[^/]+)/repository/(?P<repository>[^/]+)/token/regenerate/$",
        RepositoryTokenRegenerateEndpoint.as_view(),
        name="sentry-api-0-repository-token-regenerate",
    ),
    re_path(
        r"^owner/(?P<owner>[^/]+)/repositories/sync/$",
        SyncReposEndpoint.as_view(),
        name="sentry-api-0-repositories-sync",
    ),
    # Prevent AI endpoints
    re_path(
        r"^ai/github/config/(?P<git_organization_name>[^/]+)/$",
        OrganizationPreventGitHubConfigEndpoint.as_view(),
        name="sentry-api-0-organization-prevent-github-config",
    ),
    re_path(
        r"^ai/github/repos/$",
        OrganizationPreventGitHubReposEndpoint.as_view(),
        name="sentry-api-0-organization-prevent-github-repos",
    ),
]

USER_URLS = [
    re_path(
        r"^$",
        UserIndexEndpoint.as_view(),
        name="sentry-api-0-user-index",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/$",
        UserDetailsEndpoint.as_view(),
        name="sentry-api-0-user-details",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/regions/$",
        UserRegionsEndpoint.as_view(),
        name="sentry-api-0-user-regions",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/avatar/$",
        UserAvatarEndpoint.as_view(),
        name="sentry-api-0-user-avatar",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/authenticators/$",
        UserAuthenticatorIndexEndpoint.as_view(),
        name="sentry-api-0-user-authenticator-index",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/authenticators/(?P<interface_id>[^/]+)/enroll/$",
        UserAuthenticatorEnrollEndpoint.as_view(),
        name="sentry-api-0-user-authenticator-enroll",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/authenticators/(?P<auth_id>[^/]+)/(?P<interface_device_id>[^/]+)/$",
        UserAuthenticatorDetailsEndpoint.as_view(),
        name="sentry-api-0-user-authenticator-device-details",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/authenticators/(?P<auth_id>[^/]+)/$",
        UserAuthenticatorDetailsEndpoint.as_view(),
        name="sentry-api-0-user-authenticator-details",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/emails/$",
        UserEmailsEndpoint.as_view(),
        name="sentry-api-0-user-emails",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/emails/confirm/$",
        UserEmailsConfirmEndpoint.as_view(),
        name="sentry-api-0-user-emails-confirm",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/identities/(?P<identity_id>[^/]+)/$",
        UserIdentityDetailsEndpoint.as_view(),
        name="sentry-api-0-user-identity-details",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/identities/$",
        UserIdentityEndpoint.as_view(),
        name="sentry-api-0-user-identity",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/ips/$",
        UserIPsEndpoint.as_view(),
        name="sentry-api-0-user-ips",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/organizations/$",
        UserOrganizationsEndpoint.as_view(),
        name="sentry-api-0-user-organizations",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/notifications/$",
        UserNotificationDetailsEndpoint.as_view(),
        name="sentry-api-0-user-notifications",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/notifications/email/$",
        UserNotificationEmailEndpoint.as_view(),
        name="sentry-api-0-user-notifications-email",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/notification-options/$",
        UserNotificationSettingsOptionsEndpoint.as_view(),
        name="sentry-api-0-user-notification-options",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/notification-options/(?P<notification_option_id>[^/]+)/$",
        UserNotificationSettingsOptionsDetailEndpoint.as_view(),
        name="sentry-api-0-user-notification-options-details",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/notification-providers/$",
        UserNotificationSettingsProvidersEndpoint.as_view(),
        name="sentry-api-0-user-notification-providers",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/password/$",
        UserPasswordEndpoint.as_view(),
        name="sentry-api-0-user-password",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/permissions/$",
        UserPermissionsEndpoint.as_view(),
        name="sentry-api-0-user-permissions",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/permissions/config/$",
        UserPermissionsConfigEndpoint.as_view(),
        name="sentry-api-0-user-permissions-config",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/permissions/(?P<permission_name>[^/]+)/$",
        UserPermissionDetailsEndpoint.as_view(),
        name="sentry-api-0-user-permission-details",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/roles/$",
        UserUserRolesEndpoint.as_view(),
        name="sentry-api-0-user-userroles",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/roles/(?P<role_name>[^/]+)/$",
        UserUserRoleDetailsEndpoint.as_view(),
        name="sentry-api-0-user-userrole-details",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/subscriptions/$",
        UserSubscriptionsEndpoint.as_view(),
        name="sentry-api-0-user-subscriptions",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/organization-integrations/$",
        UserOrganizationIntegrationsEndpoint.as_view(),
        name="sentry-api-0-user-organization-integrations",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/user-identities/$",
        UserIdentityConfigEndpoint.as_view(),
        name="sentry-api-0-user-identity-config",
    ),
    re_path(
        r"^(?P<user_id>[^/]+)/user-identities/(?P<category>[\w-]+)/(?P<identity_id>[^/]+)/$",
        UserIdentityConfigDetailsEndpoint.as_view(),
        name="sentry-api-0-user-identity-config-details",
    ),
]

USER_ROLE_URLS = [
    re_path(
        r"^$",
        UserRolesEndpoint.as_view(),
        name="sentry-api-0-userroles",
    ),
    re_path(
        r"^(?P<role_name>[^/]+)/$",
        UserRoleDetailsEndpoint.as_view(),
        name="sentry-api-0-userroles-details",
    ),
]

ORGANIZATION_URLS: list[URLPattern | URLResolver] = [
    re_path(
        r"^$",
        OrganizationIndexEndpoint.as_view(),
        name="sentry-api-0-organizations",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/$",
        OrganizationDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?:issues|groups)/",
        include(create_group_urls("sentry-api-0-organization-group")),
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/shared/(?:issues|groups)/(?P<share_id>[^/]+)/$",
        SharedGroupDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-shared-group-details",
    ),
    # Alert Rules
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/alert-rules/$",
        OrganizationAlertRuleIndexEndpoint.as_view(),
        name="sentry-api-0-organization-alert-rules",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/alert-rules/available-actions/$",
        OrganizationAlertRuleAvailableActionIndexEndpoint.as_view(),
        name="sentry-api-0-organization-alert-rule-available-actions",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/alert-rules/(?P<alert_rule_id>[^/]+)/$",
        OrganizationAlertRuleDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-alert-rule-details",
    ),
    re_path(  # fetch combined metric and issue alert rules
        r"^(?P<organization_id_or_slug>[^/]+)/combined-rules/$",
        OrganizationCombinedRuleIndexEndpoint.as_view(),
        name="sentry-api-0-organization-combined-rules",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/ondemand-rules-stats/$",
        OrganizationOnDemandRuleStatsEndpoint.as_view(),
        name="sentry-api-0-organization-ondemand-rules-stats",
    ),
    # Data Export
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/data-export/$",
        DataExportEndpoint.as_view(),
        name="sentry-api-0-organization-data-export",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/data-export/(?P<data_export_id>[^/]+)/$",
        DataExportDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-data-export-details",
    ),
    # Incidents
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/incidents/(?P<incident_identifier>[^/]+)/$",
        OrganizationIncidentDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-incident-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/incidents/$",
        OrganizationIncidentIndexEndpoint.as_view(),
        name="sentry-api-0-organization-incident-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/chunk-upload/$",
        ChunkUploadEndpoint.as_view(),
        name="sentry-api-0-chunk-upload",
    ),
    # Code Path Mappings
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/code-mappings/$",
        OrganizationCodeMappingsEndpoint.as_view(),
        name="sentry-api-0-organization-code-mappings",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/derive-code-mappings/$",
        OrganizationDeriveCodeMappingsEndpoint.as_view(),
        name="sentry-api-0-organization-derive-code-mappings",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/code-mappings/(?P<config_id>[^/]+)/$",
        OrganizationCodeMappingDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-code-mapping-details",
    ),
    # Codeowners
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/code-mappings/(?P<config_id>[^/]+)/codeowners/$",
        OrganizationCodeMappingCodeOwnersEndpoint.as_view(),
        name="sentry-api-0-organization-code-mapping-codeowners",
    ),
    # Data Forwarding
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/forwarding/$",
        DataForwardingIndexEndpoint.as_view(),
        name="sentry-api-0-organization-forwarding",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/forwarding/(?P<data_forwarder_id>[^/]+)/$",
        DataForwardingDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-forwarding-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/codeowners-associations/$",
        OrganizationCodeOwnersAssociationsEndpoint.as_view(),
        name="sentry-api-0-organization-codeowners-associations",
    ),
    # Discover
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/discover/homepage/$",
        DiscoverHomepageQueryEndpoint.as_view(),
        name="sentry-api-0-discover-homepage-query",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/discover/saved/$",
        DiscoverSavedQueriesEndpoint.as_view(),
        name="sentry-api-0-discover-saved-queries",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/discover/saved/(?P<query_id>\d+)/$",
        DiscoverSavedQueryDetailEndpoint.as_view(),
        name="sentry-api-0-discover-saved-query-detail",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/discover/saved/(?P<query_id>\d+)/visit/$",
        DiscoverSavedQueryVisitEndpoint.as_view(),
        name="sentry-api-0-discover-saved-query-visit",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/key-transactions/$",
        KeyTransactionEndpoint.as_view(),
        name="sentry-api-0-organization-key-transactions",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/key-transactions-list/$",
        KeyTransactionListEndpoint.as_view(),
        name="sentry-api-0-organization-key-transactions-list",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/related-issues/$",
        OrganizationEventsRelatedIssuesEndpoint.as_view(),
        name="sentry-api-0-organization-related-issues",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/project-transaction-threshold-override/$",
        ProjectTransactionThresholdOverrideEndpoint.as_view(),
        name="sentry-api-0-organization-project-transaction-threshold-override",
    ),
    # Insights
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/insights/starred-segments/$",
        InsightsStarredSegmentsEndpoint.as_view(),
        name="sentry-api-0-insights-starred-segments",
    ),
    # Explore
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/explore/saved/$",
        ExploreSavedQueriesEndpoint.as_view(),
        name="sentry-api-0-explore-saved-queries",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/explore/saved/(?P<id>\d+)/$",
        ExploreSavedQueryDetailEndpoint.as_view(),
        name="sentry-api-0-explore-saved-query-detail",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/explore/saved/(?P<id>\d+)/visit/$",
        ExploreSavedQueryVisitEndpoint.as_view(),
        name="sentry-api-0-explore-saved-query-visit",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/explore/saved/(?P<id>\d+)/starred/$",
        ExploreSavedQueryStarredEndpoint.as_view(),
        name="sentry-api-0-explore-saved-query-starred",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/explore/saved/starred/order/$",
        ExploreSavedQueryStarredOrderEndpoint.as_view(),
        name="sentry-api-0-explore-saved-query-starred-order",
    ),
    # Dashboards
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/dashboards/$",
        OrganizationDashboardsEndpoint.as_view(),
        name="sentry-api-0-organization-dashboards",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/dashboards/widgets/$",
        OrganizationDashboardWidgetDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-dashboard-widget-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/dashboards/starred/$",
        OrganizationDashboardsStarredEndpoint.as_view(),
        name="sentry-api-0-organization-dashboard-starred",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/dashboards/starred/order/$",
        OrganizationDashboardsStarredOrderEndpoint.as_view(),
        name="sentry-api-0-organization-dashboard-starred-order",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/dashboards/(?P<dashboard_id>[^/]+)/$",
        OrganizationDashboardDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-dashboard-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/dashboards/(?P<dashboard_id>[^/]+)/visit/$",
        OrganizationDashboardVisitEndpoint.as_view(),
        name="sentry-api-0-organization-dashboard-visit",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/dashboards/(?P<dashboard_id>[^/]+)/favorite/$",
        OrganizationDashboardFavoriteEndpoint.as_view(),
        name="sentry-api-0-organization-dashboard-favorite",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/shortids/(?P<issue_id>[^/]+)/$",
        ShortIdLookupEndpoint.as_view(),
        name="sentry-api-0-short-id-lookup",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/eventids/(?P<event_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        EventIdLookupEndpoint.as_view(),
        name="sentry-api-0-event-id-lookup",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/data-scrubbing-selector-suggestions/$",
        DataScrubbingSelectorSuggestionsEndpoint.as_view(),
        name="sentry-api-0-data-scrubbing-selector-suggestions",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/access-requests/$",
        OrganizationAccessRequestDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-access-requests",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/access-requests/(?P<request_id>\d+)/$",
        OrganizationAccessRequestDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-access-request-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/api-keys/$",
        OrganizationApiKeyIndexEndpoint.as_view(),
        name="sentry-api-0-organization-api-key-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/api-keys/(?P<api_key_id>[^/]+)/$",
        OrganizationApiKeyDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-api-key-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/project-keys/$",
        OrganizationProjectKeysEndpoint.as_view(),
        name="sentry-api-0-organization-project-keys",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/audit-logs/$",
        OrganizationAuditLogsEndpoint.as_view(),
        name="sentry-api-0-organization-audit-logs",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/auth-provider/$",
        OrganizationAuthProviderDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-auth-provider",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/auth-providers/$",
        OrganizationAuthProvidersEndpoint.as_view(),
        name="sentry-api-0-organization-auth-providers",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/avatar/$",
        OrganizationAvatarEndpoint.as_view(),
        name="sentry-api-0-organization-avatar",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/artifactbundle/assemble/$",
        OrganizationArtifactBundleAssembleEndpoint.as_view(),
        name="sentry-api-0-organization-artifactbundle-assemble",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/config/integrations/$",
        OrganizationConfigIntegrationsEndpoint.as_view(),
        name="sentry-api-0-organization-config-integrations",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/config/repos/$",
        OrganizationConfigRepositoriesEndpoint.as_view(),
        name="sentry-api-0-organization-config-repositories",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sampling/project-rates/$",
        OrganizationSamplingProjectRatesEndpoint.as_view(),
        name="sentry-api-0-organization-sampling-project-rates",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sampling/project-root-counts/$",
        OrganizationSamplingProjectSpanCountsEndpoint.as_view(),
        name="sentry-api-0-organization-sampling-root-counts",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sampling/effective-sample-rate/$",
        OrganizationSamplingEffectiveSampleRateEndpoint.as_view(),
        name="sentry-api-0-organization-sampling-effective-sample-rate",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sampling/admin-metrics/$",
        OrganizationDynamicSamplingAdminMetricsEndpoint.as_view(),
        name="sentry-api-0-organization-sampling-admin-metrics",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sdk-updates/$",
        OrganizationSdkUpdatesEndpoint.as_view(),
        name="sentry-api-0-organization-sdk-updates",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sdk-deprecations/$",
        OrganizationSdkDeprecationsEndpoint.as_view(),
        name="sentry-api-0-organization-sdk-deprecations",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sdks/$",
        OrganizationSdksEndpoint.as_view(),
        name="sentry-api-0-organization-sdks",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events/$",
        OrganizationEventsEndpoint.as_view(),
        name="sentry-api-0-organization-events",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events/(?P<project_id_or_slug>[^/]+):(?P<event_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        OrganizationEventDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-event-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-stats/$",
        OrganizationEventsStatsEndpoint.as_view(),
        name="sentry-api-0-organization-events-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-timeseries/$",
        OrganizationEventsTimeseriesEndpoint.as_view(),
        name="sentry-api-0-organization-events-timeseries",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events/anomalies/$",
        OrganizationEventsAnomaliesEndpoint.as_view(),
        name="sentry-api-0-organization-events-anomalies",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/project-templates/$",
        OrganizationProjectTemplatesIndexEndpoint.as_view(),
        name="sentry-api-0-organization-project-templates",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/project-templates/(?P<template_id>[^/]+)/$",
        OrganizationProjectTemplateDetailEndpoint.as_view(),
        name="sentry-api-0-organization-project-template-detail",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/traces/$",
        OrganizationTracesEndpoint.as_view(),
        name="sentry-api-0-organization-traces",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/ai-conversations/$",
        OrganizationAIConversationsEndpoint.as_view(),
        name="sentry-api-0-organization-ai-conversations",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace-items/attributes/$",
        OrganizationTraceItemAttributesEndpoint.as_view(),
        name="sentry-api-0-organization-trace-item-attributes",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace-items/attributes/(?P<key>[^/]+)/values/$",
        OrganizationTraceItemAttributeValuesEndpoint.as_view(),
        name="sentry-api-0-organization-trace-item-attribute-values",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace-items/attributes/ranked/$",
        OrganizationTraceItemsAttributesRankedEndpoint.as_view(),
        name="sentry-api-0-organization-trace-item-attributes-ranked",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace-items/stats/$",
        OrganizationTraceItemsStatsEndpoint.as_view(),
        name="sentry-api-0-organization-trace-item-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/spans/fields/$",
        OrganizationSpansFieldsEndpoint.as_view(),
        name="sentry-api-0-organization-spans-fields",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/spans/fields/(?P<key>[^/]+)/values/$",
        OrganizationSpansFieldValuesEndpoint.as_view(),
        name="sentry-api-0-organization-spans-fields-values",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/spans/fields/stats/$",
        OrganizationSpansFieldsStatsEndpoint.as_view(),
        name="sentry-api-0-organization-spans-fields-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/metrics-estimation-stats/$",
        OrganizationOnDemandMetricsEstimationStatsEndpoint.as_view(),
        name="sentry-api-0-organization-metrics-estimation-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-facets/$",
        OrganizationEventsFacetsEndpoint.as_view(),
        name="sentry-api-0-organization-events-facets",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-facets-performance/$",
        OrganizationEventsFacetsPerformanceEndpoint.as_view(),
        name="sentry-api-0-organization-events-facets-performance",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-facets-performance-histogram/$",
        OrganizationEventsFacetsPerformanceHistogramEndpoint.as_view(),
        name="sentry-api-0-organization-events-facets-performance-histogram",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-span-ops/$",
        OrganizationEventsSpanOpsEndpoint.as_view(),
        name="sentry-api-0-organization-events-span-ops",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-spans/$",
        OrganizationEventsSpansExamplesEndpoint.as_view(),
        name="sentry-api-0-organization-events-spans",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-spans-performance/$",
        OrganizationEventsSpansPerformanceEndpoint.as_view(),
        name="sentry-api-0-organization-events-spans-performance",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-spans-stats/$",
        OrganizationEventsSpansStatsEndpoint.as_view(),
        name="sentry-api-0-organization-events-spans-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-root-cause-analysis/$",
        OrganizationEventsRootCauseAnalysisEndpoint.as_view(),
        name="sentry-api-0-organization-events-root-cause-analysis",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-meta/$",
        OrganizationEventsMetaEndpoint.as_view(),
        name="sentry-api-0-organization-events-meta",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/spans-samples/$",
        OrganizationSpansSamplesEndpoint.as_view(),
        name="sentry-api-0-organization-spans-samples",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/metrics-compatibility/$",
        OrganizationMetricsCompatibility.as_view(),
        name="sentry-api-0-organization-metrics-compatibility",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/metrics-compatibility-sums/$",
        OrganizationMetricsCompatibilitySums.as_view(),
        name="sentry-api-0-organization-metrics-compatibility-sums",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/missing-members/$",
        OrganizationMissingMembersEndpoint.as_view(),
        name="sentry-api-0-organization-missing-members",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-histogram/$",
        OrganizationEventsHistogramEndpoint.as_view(),
        name="sentry-api-0-organization-events-histogram",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-spans-histogram/$",
        OrganizationEventsSpansHistogramEndpoint.as_view(),
        name="sentry-api-0-organization-events-spans-histogram",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-trends/$",
        OrganizationEventsTrendsEndpoint.as_view(),
        name="sentry-api-0-organization-events-trends",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-vitals/$",
        OrganizationEventsVitalsEndpoint.as_view(),
        name="sentry-api-0-organization-events-vitals",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-has-measurements/$",
        OrganizationEventsHasMeasurementsEndpoint.as_view(),
        name="sentry-api-0-organization-events-has-measurements",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-trends-stats/$",
        OrganizationEventsTrendsStatsEndpoint.as_view(),
        name="sentry-api-0-organization-events-trends-stats",
    ),
    # This endpoint is for experimentation only
    # Once this feature is developed, the endpoint will replace /events-trends-stats
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-trends-statsv2/$",
        OrganizationEventsNewTrendsStatsEndpoint.as_view(),
        name="sentry-api-0-organization-events-trends-statsv2",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-trace-light/(?P<trace_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        OrganizationEventsTraceLightEndpoint.as_view(),
        name="sentry-api-0-organization-events-trace-light",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-trace/(?P<trace_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        OrganizationEventsTraceEndpoint.as_view(),
        name="sentry-api-0-organization-events-trace",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/events-trace-meta/(?P<trace_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        OrganizationEventsTraceMetaEndpoint.as_view(),
        name="sentry-api-0-organization-events-trace-meta",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace/(?P<trace_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        OrganizationTraceEndpoint.as_view(),
        name="sentry-api-0-organization-trace",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace-meta/(?P<trace_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        OrganizationTraceMetaEndpoint.as_view(),
        name="sentry-api-0-organization-trace-meta",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace-logs/$",
        OrganizationTraceLogsEndpoint.as_view(),
        name="sentry-api-0-organization-trace-logs",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace-summary/$",
        OrganizationTraceSummaryEndpoint.as_view(),
        name="sentry-api-0-organization-trace-summary",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/measurements-meta/$",
        OrganizationMeasurementsMeta.as_view(),
        name="sentry-api-0-organization-measurements-meta",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/issues/$",
        OrganizationGroupIndexEndpoint.as_view(),
        name="sentry-api-0-organization-group-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/issues-count/$",
        OrganizationIssuesCountEndpoint.as_view(),
        name="sentry-api-0-organization-issues-count",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/issues-stats/$",
        OrganizationGroupIndexStatsEndpoint.as_view(),
        name="sentry-api-0-organization-group-index-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/issues-metrics/$",
        OrganizationIssueMetricsEndpoint.as_view(),
        name="sentry-api-0-organization-issue-metrics",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/issues-timeseries/$",
        OrganizationIssueTimeSeriesEndpoint.as_view(),
        name="sentry-api-0-organization-issue-timeseries",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integrations/$",
        OrganizationIntegrationsEndpoint.as_view(),
        name="sentry-api-0-organization-integrations",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integrations/coding-agents/$",
        OrganizationCodingAgentsEndpoint.as_view(),
        name="sentry-api-0-organization-coding-agents",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integrations/(?P<integration_id>[^/]+)/$",
        OrganizationIntegrationDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-integration-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integrations/(?P<integration_id>[^/]+)/repos/$",
        OrganizationIntegrationReposEndpoint.as_view(),
        name="sentry-api-0-organization-integration-repos",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integrations/(?P<integration_id>[^/]+)/channels/$",
        OrganizationIntegrationChannelsEndpoint.as_view(),
        name="sentry-api-0-organization-integration-channels",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integrations/(?P<integration_id>[^/]+)/channel-validate/$",
        OrganizationIntegrationChannelValidateEndpoint.as_view(),
        name="sentry-api-0-organization-integration-channel-validate",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integrations/(?P<integration_id>[^/]+)/issues/$",
        OrganizationIntegrationIssuesEndpoint.as_view(),
        name="sentry-api-0-organization-integration-issues",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integrations/(?P<integration_id>[^/]+)/migrate-opsgenie/$",
        OrganizationIntegrationMigrateOpsgenieEndpoint.as_view(),
        name="sentry-api-0-organization-integration-migrate-opsgenie",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integrations/(?P<integration_id>[^/]+)/serverless-functions/$",
        OrganizationIntegrationServerlessFunctionsEndpoint.as_view(),
        name="sentry-api-0-organization-integration-serverless-functions",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/members/$",
        OrganizationMemberIndexEndpoint.as_view(),
        name="sentry-api-0-organization-member-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/invited-members/$",
        OrganizationMemberInviteIndexEndpoint.as_view(),
        name="sentry-api-0-organization-member-invite-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/invited-members/(?P<member_invite_id>[^/]+)/$",
        OrganizationMemberInviteDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-member-invite-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/invited-members/(?P<member_invite_id>[^/]+)/reinvite/$",
        OrganizationMemberReinviteEndpoint.as_view(),
        name="sentry-api-0-organization-member-reinvite",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/external-users/$",
        ExternalUserEndpoint.as_view(),
        name="sentry-api-0-organization-external-user",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/external-users/(?P<external_user_id>[^/]+)/$",
        ExternalUserDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-external-user-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/integration-requests/$",
        OrganizationIntegrationRequestEndpoint.as_view(),
        name="sentry-api-0-organization-integration-request",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/invite-requests/$",
        OrganizationInviteRequestIndexEndpoint.as_view(),
        name="sentry-api-0-organization-invite-request-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/invite-requests/(?P<member_id>[^/]+)/$",
        OrganizationInviteRequestDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-invite-request-detail",
    ),
    # Notification Actions
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/notifications/actions/$",
        NotificationActionsIndexEndpoint.as_view(),
        name="sentry-api-0-organization-notification-actions",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/notifications/actions/(?P<action_id>[^/]+)/$",
        NotificationActionsDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-notification-actions-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/notifications/available-actions/$",
        NotificationActionsAvailableEndpoint.as_view(),
        name="sentry-api-0-organization-notification-available-actions",
    ),
    # Monitors
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/monitors/$",
        OrganizationMonitorIndexEndpoint.as_view(),
        name="sentry-api-0-organization-monitor-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/monitors-count/$",
        OrganizationMonitorIndexCountEndpoint.as_view(),
        name="sentry-api-0-organization-monitor-index-count",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/monitors-stats/$",
        OrganizationMonitorIndexStatsEndpoint.as_view(),
        name="sentry-api-0-organization-monitor-index-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/processing-errors/$",
        OrganizationMonitorProcessingErrorsIndexEndpoint.as_view(),
        name="sentry-api-0-organization-monitor-processing-errors-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/monitors-schedule-data/$",
        OrganizationMonitorScheduleSampleDataEndpoint.as_view(),
        name="sentry-api-0-organization-monitors-schedule-sample-data",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/monitors/(?P<monitor_id_or_slug>[^/]+)/$",
        OrganizationMonitorDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-monitor-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/monitors/(?P<monitor_id_or_slug>[^/]+)/environments/(?P<environment>[^/]+)/$",
        OrganizationMonitorEnvironmentDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-monitor-environment-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/monitors/(?P<monitor_id_or_slug>[^/]+)/stats/$",
        OrganizationMonitorStatsEndpoint.as_view(),
        name="sentry-api-0-organization-monitor-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/monitors/(?P<monitor_id_or_slug>[^/]+)/checkins/$",
        OrganizationMonitorCheckInIndexEndpoint.as_view(),
        name="sentry-api-0-organization-monitor-check-in-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/group-search-views/$",
        OrganizationGroupSearchViewsEndpoint.as_view(),
        name="sentry-api-0-organization-group-search-views",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/group-search-views/starred/$",
        OrganizationGroupSearchViewsStarredEndpoint.as_view(),
        name="sentry-api-0-organization-group-search-views-starred",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/group-search-views/(?P<view_id>[^/]+)/$",
        OrganizationGroupSearchViewDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-group-search-view-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/group-search-views/(?P<view_id>[^/]+)/visit/$",
        OrganizationGroupSearchViewVisitEndpoint.as_view(),
        name="sentry-api-0-organization-group-search-view-visit",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/group-search-views/(?P<view_id>[^/]+)/starred/$",
        OrganizationGroupSearchViewDetailsStarredEndpoint.as_view(),
        name="sentry-api-0-organization-group-search-view-starred",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/group-search-views/starred/order/$",
        OrganizationGroupSearchViewStarredOrderEndpoint.as_view(),
        name="sentry-api-0-organization-group-search-view-starred-order",
    ),
    # Pinned and saved search
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/pinned-searches/$",
        OrganizationPinnedSearchEndpoint.as_view(),
        name="sentry-api-0-organization-pinned-searches",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/recent-searches/$",
        OrganizationRecentSearchesEndpoint.as_view(),
        name="sentry-api-0-organization-recent-searches",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/searches/(?P<search_id>[^/]+)/$",
        OrganizationSearchDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-search-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/searches/$",
        OrganizationSearchesEndpoint.as_view(),
        name="sentry-api-0-organization-searches",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sessions/$",
        OrganizationSessionsEndpoint.as_view(),
        name="sentry-api-0-organization-sessions",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/resolved/$",
        OrganizationIssuesResolvedInReleaseEndpoint.as_view(),
        name="sentry-api-0-organization-release-resolved",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/members/(?P<member_id>[^/]+)/$",
        OrganizationMemberDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-member-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/members/(?P<member_id>[^/]+)/teams/(?P<team_id_or_slug>[^/]+)/$",
        OrganizationMemberTeamDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-member-team-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/onboarding-continuation-email/$",
        OrganizationOnboardingContinuationEmail.as_view(),
        name="sentry-api-0-organization-onboarding-continuation-email",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/projects/$",
        OrganizationProjectsEndpoint.as_view(),
        name="sentry-api-0-organization-projects",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/experimental/projects/$",
        OrganizationProjectsExperimentEndpoint.as_view(),
        name="sentry-api-0-organization-projects-experiment",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/projects-count/$",
        OrganizationProjectsCountEndpoint.as_view(),
        name="sentry-api-0-organization-projects-count",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sent-first-event/$",
        OrganizationProjectsSentFirstEventEndpoint.as_view(),
        name="sentry-api-0-organization-sent-first-event",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/repos/$",
        OrganizationRepositoriesEndpoint.as_view(),
        name="sentry-api-0-organization-repositories",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/repos/settings/$",
        OrganizationRepositorySettingsEndpoint.as_view(),
        name="sentry-api-0-organization-repository-settings",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/repos/(?P<repo_id>[^/]+)/$",
        OrganizationRepositoryDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-repository-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/repos/(?P<repo_id>[^/]+)/commits/$",
        OrganizationRepositoryCommitsEndpoint.as_view(),
        name="sentry-api-0-organization-repository-commits",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/plugins/$",
        OrganizationPluginsEndpoint.as_view(),
        name="sentry-api-0-organization-plugins",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/plugins/configs/$",
        OrganizationPluginsConfigsEndpoint.as_view(),
        name="sentry-api-0-organization-plugins-configs",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/$",
        OrganizationReleasesEndpoint.as_view(),
        name="sentry-api-0-organization-releases",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/release-thresholds/$",
        ReleaseThresholdIndexEndpoint.as_view(),
        name="sentry-api-0-organization-release-thresholds",
    ),
    # TODO: also integrate release threshold status into the releases response?
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/release-threshold-statuses/$",
        ReleaseThresholdStatusIndexEndpoint.as_view(),
        name="sentry-api-0-organization-release-threshold-statuses",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/stats/$",
        OrganizationReleasesStatsEndpoint.as_view(),
        name="sentry-api-0-organization-releases-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/$",
        OrganizationReleaseDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-release-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/meta/$",
        OrganizationReleaseMetaEndpoint.as_view(),
        name="sentry-api-0-organization-release-meta",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/assemble/$",
        OrganizationReleaseAssembleEndpoint.as_view(),
        name="sentry-api-0-organization-release-assemble",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/files/$",
        OrganizationReleaseFilesEndpoint.as_view(),
        name="sentry-api-0-organization-release-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/files/(?P<file_id>[^/]+)/$",
        OrganizationReleaseFileDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-release-file-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/commitfiles/$",
        CommitFileChangeEndpoint.as_view(),
        name="sentry-api-0-release-commitfilechange",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/deploys/$",
        ReleaseDeploysEndpoint.as_view(),
        name="sentry-api-0-organization-release-deploys",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/commits/$",
        OrganizationReleaseCommitsEndpoint.as_view(),
        name="sentry-api-0-organization-release-commits",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/previous-with-commits/$",
        OrganizationReleasePreviousCommitsEndpoint.as_view(),
        name="sentry-api-0-organization-release-previous-with-commits",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/user-feedback/$",
        OrganizationUserReportsEndpoint.as_view(),
        name="sentry-api-0-organization-user-feedback",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/feedback-summary/$",
        OrganizationFeedbackSummaryEndpoint.as_view(),
        name="sentry-api-0-organization-user-feedback-summary",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/feedback-categories/$",
        OrganizationFeedbackCategoriesEndpoint.as_view(),
        name="sentry-api-0-organization-user-feedback-categories",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/user-teams/$",
        OrganizationUserTeamsEndpoint.as_view(),
        name="sentry-api-0-organization-user-teams",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/users/$",
        OrganizationUsersEndpoint.as_view(),
        name="sentry-api-0-organization-users",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/users/(?P<user_id>[^/]+)/$",
        OrganizationUserDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-user-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sentry-app-installations/$",
        SentryAppInstallationsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installations",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sentry-apps/$",
        OrganizationSentryAppsEndpoint.as_view(),
        name="sentry-api-0-organization-sentry-apps",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace-explorer-ai/setup/$",
        TraceExplorerAISetup.as_view(),
        name="sentry-api-0-trace-explorer-ai-setup",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/trace-explorer-ai/query/$",
        TraceExplorerAIQuery.as_view(),
        name="sentry-api-0-trace-explorer-ai-query",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/search-agent/translate/$",
        SearchAgentTranslateEndpoint.as_view(),
        name="sentry-api-0-search-agent-translate",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/seer/explorer-chat/(?:(?P<run_id>[^/]+)/)?$",
        OrganizationSeerExplorerChatEndpoint.as_view(),
        name="sentry-api-0-organization-seer-explorer-chat",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/seer/explorer-runs/$",
        OrganizationSeerExplorerRunsEndpoint.as_view(),
        name="sentry-api-0-organization-seer-explorer-runs",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/seer/explorer-update/(?P<run_id>[^/]+)/$",
        OrganizationSeerExplorerUpdateEndpoint.as_view(),
        name="sentry-api-0-organization-seer-explorer-update",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/seer/setup-check/$",
        OrganizationSeerSetupCheckEndpoint.as_view(),
        name="sentry-api-0-organization-seer-setup-check",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/seer/onboarding-check/$",
        OrganizationSeerOnboardingCheck.as_view(),
        name="sentry-api-0-organization-seer-onboarding-check",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/autofix/automation-settings/$",
        OrganizationAutofixAutomationSettingsEndpoint.as_view(),
        name="sentry-api-0-organization-autofix-automation-settings",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/seer-rpc/(?P<method_name>\w+)/$",
        OrganizationSeerRpcEndpoint.as_view(),
        name="sentry-api-0-organization-seer-rpc",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/sentry-app-components/$",
        OrganizationSentryAppComponentsEndpoint.as_view(),
        name="sentry-api-0-organization-sentry-app-components",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/org-auth-tokens/$",
        OrganizationAuthTokensEndpoint.as_view(),
        name="sentry-api-0-org-auth-tokens",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/org-auth-tokens/(?P<token_id>[^/]+)/$",
        OrganizationAuthTokenDetailsEndpoint.as_view(),
        name="sentry-api-0-org-auth-token-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/stats/$",
        OrganizationStatsEndpoint.as_view(),
        name="sentry-api-0-organization-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/stats_v2/$",
        OrganizationStatsEndpointV2.as_view(),
        name="sentry-api-0-organization-stats-v2",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/stats-summary/$",
        OrganizationStatsSummaryEndpoint.as_view(),
        name="sentry-api-0-organization-stats-summary",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/teams/$",
        OrganizationTeamsEndpoint.as_view(),
        name="sentry-api-0-organization-teams",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/tags/$",
        OrganizationTagsEndpoint.as_view(),
        name="sentry-api-0-organization-tags",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/tags/(?P<key>[^/]+)/values/$",
        OrganizationTagKeyValuesEndpoint.as_view(),
        name="sentry-api-0-organization-tagkey-values",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/onboarding-tasks/$",
        OrganizationOnboardingTaskEndpoint.as_view(),
        name="sentry-api-0-organization-onboardingtasks",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/environments/$",
        OrganizationEnvironmentsEndpoint.as_view(),
        name="sentry-api-0-organization-environments",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/broadcasts/$",
        BroadcastIndexEndpoint.as_view(),
        name="sentry-api-0-organization-broadcasts",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/join-request/$",
        OrganizationJoinRequestEndpoint.as_view(),
        name="sentry-api-0-organization-join-request",
    ),
    # relay usage
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/relay_usage/$",
        OrganizationRelayUsage.as_view(),
        name="sentry-api-0-organization-relay-usage",
    ),
    # Flags
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/flags/logs/$",
        OrganizationFlagLogIndexEndpoint.as_view(),
        name="sentry-api-0-organization-flag-logs",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/flags/logs/(?P<flag_log_id>\d+)/$",
        OrganizationFlagLogDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-flag-log",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/flags/hooks/provider/(?P<provider>[\w-]+)/$",
        OrganizationFlagsHooksEndpoint.as_view(),
        name="sentry-api-0-organization-flag-hooks",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/flags/signing-secrets/$",
        OrganizationFlagsWebHookSigningSecretsEndpoint.as_view(),
        name="sentry-api-0-organization-flag-hooks-signing-secrets",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/flags/signing-secrets/(?P<signing_secret_id>\d+)/$",
        OrganizationFlagsWebHookSigningSecretEndpoint.as_view(),
        name="sentry-api-0-organization-flag-hooks-signing-secret",
    ),
    # Replays
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/replays/$",
        OrganizationReplayIndexEndpoint.as_view(),
        name="sentry-api-0-organization-replay-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/replay-selectors/$",
        OrganizationReplaySelectorIndexEndpoint.as_view(),
        name="sentry-api-0-organization-replay-selectors-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/replay-count/$",
        OrganizationReplayCountEndpoint.as_view(),
        name="sentry-api-0-organization-replay-count",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/replays/(?P<replay_id>[^/]+)/$",
        OrganizationReplayDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-replay-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/replays-events-meta/$",
        OrganizationReplayEventsMetaEndpoint.as_view(),
        name="sentry-api-0-organization-replay-events-meta",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/request-project-creation/$",
        OrganizationRequestProjectCreation.as_view(),
        name="sentry-api-0-organization-request-project-creation",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/scim/v2/",
        include(
            [
                re_path(
                    r"^Users$",
                    OrganizationSCIMMemberIndex.as_view(),
                    name="sentry-api-0-organization-scim-member-index",
                ),
                re_path(
                    r"^Users/(?P<member_id>\d+)$",
                    OrganizationSCIMMemberDetails.as_view(),
                    name="sentry-api-0-organization-scim-member-details",
                ),
                re_path(
                    r"^Groups$",
                    OrganizationSCIMTeamIndex.as_view(),
                    name="sentry-api-0-organization-scim-team-index",
                ),
                re_path(
                    r"^Groups/(?P<team_id_or_slug>\d+)$",
                    OrganizationSCIMTeamDetails.as_view(),
                    name="sentry-api-0-organization-scim-team-details",
                ),
                re_path(
                    r"^Schemas$",
                    OrganizationSCIMSchemaIndex.as_view(),
                    name="sentry-api-0-organization-scim-schema-index",
                ),
            ]
        ),
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/metrics/data/$",
        OrganizationReleaseHealthDataEndpoint.as_view(),
        name="sentry-api-0-organization-metrics-data",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/profiling/",
        include(
            [
                re_path(
                    r"^flamegraph/$",
                    OrganizationProfilingFlamegraphEndpoint.as_view(),
                    name="sentry-api-0-organization-profiling-flamegraph",
                ),
                re_path(
                    r"^function-trends/$",
                    OrganizationProfilingFunctionTrendsEndpoint.as_view(),
                    name="sentry-api-0-organization-profiling-function-trends",
                ),
                re_path(
                    r"^chunks/$",
                    OrganizationProfilingChunksEndpoint.as_view(),
                    name="sentry-api-0-organization-profiling-chunks",
                ),
                re_path(
                    r"^has-chunks/$",
                    OrganizationProfilingHasChunksEndpoint.as_view(),
                    name="sentry-api-0-organization-profiling-has-chunks",
                ),
            ],
        ),
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/dynamic-sampling/",
        include(
            [
                re_path(
                    r"^custom-rules/$",
                    CustomRulesEndpoint.as_view(),
                    name="sentry-api-0-organization-dynamic_sampling-custom_rules",
                ),
            ],
        ),
    ),
    # Symbolicator Builtin Sources
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/builtin-symbol-sources/$",
        BuiltinSymbolSourcesEndpoint.as_view(),
        name="sentry-api-0-organization-builtin-symbol-sources",
    ),
    # Unsubscribe from organization notifications
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/unsubscribe/project/(?P<id>\d+)/$",
        OrganizationUnsubscribeProject.as_view(),
        name="sentry-api-0-organization-unsubscribe-project",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/unsubscribe/issue/(?P<id>\d+)/$",
        OrganizationUnsubscribeIssue.as_view(),
        name="sentry-api-0-organization-unsubscribe-issue",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/prompts-activity/$",
        PromptsActivityEndpoint.as_view(),
        name="sentry-api-0-organization-prompts-activity",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/region/$",
        OrganizationRegionEndpoint.as_view(),
        name="sentry-api-0-organization-region",
    ),
    # Trigger relocation
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/fork/$",
        OrganizationForkEndpoint.as_view(),
        name="sentry-api-0-organization-fork",
    ),
    # Uptime
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/uptime/$",
        OrganizationUptimeAlertIndexEndpoint.as_view(),
        name="sentry-api-0-organization-uptime-alert-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/uptime-count/$",
        OrganizationUptimeAlertIndexCountEndpoint.as_view(),
        name="sentry-api-0-organization-uptime-alert-index-count",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/uptime-stats/$",
        OrganizationUptimeStatsEndpoint.as_view(),
        name="sentry-api-0-organization-uptime-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/uptime-summary/$",
        OrganizationUptimeSummaryEndpoint.as_view(),
        name="sentry-api-0-organization-uptime-summary",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/insights/tree/$",
        OrganizationInsightsTreeEndpoint.as_view(),
        name="sentry-api-0-organization-insights-tree",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/prevent/",
        include(PREVENT_URLS),
    ),
    *workflow_urls.organization_urlpatterns,
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/plugins/(?P<plugin_slug>[^/]+)/deprecation-info/$",
        OrganizationPluginDeprecationInfoEndpoint.as_view(),
        name="sentry-api-0-organization-plugin-deprecation-info",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/conduit-demo/$",
        OrganizationConduitDemoEndpoint.as_view(),
        name="sentry-api-0-organization-conduit-demo",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/objectstore/(?P<path>.*)$",
        OrganizationObjectstoreEndpoint.as_view(),
        name="sentry-api-0-organization-objectstore",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/preprod/app-size-stats/$",
        preprod_urls.OrganizationPreprodAppSizeStatsEndpoint.as_view(),
        name="sentry-api-0-organization-preprod-app-size-stats",
    ),
]

PROJECT_URLS: list[URLPattern | URLResolver] = [
    re_path(
        r"^$",
        ProjectIndexEndpoint.as_view(),
        name="sentry-api-0-projects",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/$",
        ProjectDetailsEndpoint.as_view(),
        name="sentry-api-0-project-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/alert-rules/(?P<alert_rule_id>[^/]+)/$",
        ProjectAlertRuleDetailsEndpoint.as_view(),
        name="sentry-api-0-project-alert-rule-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/alert-rules/$",
        ProjectAlertRuleIndexEndpoint.as_view(),
        name="sentry-api-0-project-alert-rules",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/alert-rule-task/(?P<task_uuid>[^/]+)/$",
        ProjectAlertRuleTaskDetailsEndpoint.as_view(),
        name="sentry-api-0-project-alert-rule-task-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/create-sample/$",
        ProjectCreateSampleEndpoint.as_view(),
        name="sentry-api-0-project-create-sample",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/create-sample-transaction/$",
        ProjectCreateSampleTransactionEndpoint.as_view(),
        name="sentry-api-0-project-create-sample-transaction",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/environments/$",
        ProjectEnvironmentsEndpoint.as_view(),
        name="sentry-api-0-project-environments",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/environments/(?P<environment>[^/]+)/$",
        ProjectEnvironmentDetailsEndpoint.as_view(),
        name="sentry-api-0-project-environment-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/trace-items/(?P<item_id>(?:[A-Fa-f0-9]+))/$",
        ProjectTraceItemDetailsEndpoint.as_view(),
        name="sentry-api-0-project-trace-item-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/$",
        ProjectEventsEndpoint.as_view(),
        name="sentry-api-0-project-events",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>(?:\d+|[A-Fa-f0-9]{32}))/$",
        ProjectEventDetailsEndpoint.as_view(),
        name="sentry-api-0-project-event-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/grouping-info/$",
        EventGroupingInfoEndpoint.as_view(),
        name="sentry-api-0-event-grouping-info",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/apple-crash-report$",
        EventAppleCrashReportEndpoint.as_view(),
        name="sentry-api-0-event-apple-crash-report",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/attachments/$",
        EventAttachmentsEndpoint.as_view(),
        name="sentry-api-0-event-attachments",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/reprocessable/$",
        EventReprocessableEndpoint.as_view(),
        name="sentry-api-0-event-attachments",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/attachments/(?P<attachment_id>[^/]+)/$",
        EventAttachmentDetailsEndpoint.as_view(),
        name="sentry-api-0-event-attachment-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/committers/$",
        EventFileCommittersEndpoint.as_view(),
        name="sentry-api-0-event-file-committers",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/json/$",
        EventJsonEndpoint.as_view(),
        name="sentry-api-0-event-json",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/owners/$",
        EventOwnersEndpoint.as_view(),
        name="sentry-api-0-event-owners",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/source-map-debug/$",
        SourceMapDebugEndpoint.as_view(),
        name="sentry-api-0-event-source-map-debug",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/source-map-debug-blue-thunder-edition/$",
        SourceMapDebugBlueThunderEditionEndpoint.as_view(),
        name="sentry-api-0-event-source-map-debug-blue-thunder-edition",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/events/(?P<event_id>[^/]+)/actionable-items/$",
        ActionableItemsEndpoint.as_view(),
        name="sentry-api-0-event-actionable-items",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/dsyms/$",
        DebugFilesEndpoint.as_view(),
        name="sentry-api-0-dsym-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/source-maps/$",
        SourceMapsEndpoint.as_view(),
        name="sentry-api-0-source-maps",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/artifact-bundles/$",
        ArtifactBundlesEndpoint.as_view(),
        name="sentry-api-0-artifact-bundles",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/proguard-artifact-releases",
        ProguardArtifactReleasesEndpoint.as_view(),
        name="sentry-api-0-proguard-artifact-releases",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/difs/assemble/$",
        DifAssembleEndpoint.as_view(),
        name="sentry-api-0-assemble-dif-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/dsyms/unknown/$",
        UnknownDebugFilesEndpoint.as_view(),
        name="sentry-api-0-unknown-dsym-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/files/dsyms/associate/$",
        AssociateDSymFilesEndpoint.as_view(),
        name="sentry-api-0-associate-dsym-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/filters/$",
        ProjectFiltersEndpoint.as_view(),
        name="sentry-api-0-project-filters",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/filters/(?P<filter_id>[^/]+)/$",
        ProjectFilterDetailsEndpoint.as_view(),
        name="sentry-api-0-project-filters-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/hooks/$",
        ProjectServiceHooksEndpoint.as_view(),
        name="sentry-api-0-service-hooks",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/hooks/(?P<hook_id>[^/]+)/$",
        ProjectServiceHookDetailsEndpoint.as_view(),
        name="sentry-api-0-project-service-hook-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/hooks/(?P<hook_id>[^/]+)/stats/$",
        ProjectServiceHookStatsEndpoint.as_view(),
        name="sentry-api-0-project-service-hook-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/(?:issues|groups)/$",
        ProjectGroupIndexEndpoint.as_view(),
        name="sentry-api-0-project-group-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/(?:issues|groups)/stats/$",
        ProjectGroupStatsEndpoint.as_view(),
        name="sentry-api-0-project-group-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/keys/$",
        ProjectKeysEndpoint.as_view(),
        name="sentry-api-0-project-keys",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/keys/(?P<key_id>[^/]+)/$",
        ProjectKeyDetailsEndpoint.as_view(),
        name="sentry-api-0-project-key-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/keys/(?P<key_id>[^/]+)/stats/$",
        ProjectKeyStatsEndpoint.as_view(),
        name="sentry-api-0-project-key-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/members/$",
        ProjectMemberIndexEndpoint.as_view(),
        name="sentry-api-0-project-member-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/overview/$",
        ProjectOverviewEndpoint.as_view(),
        name="sentry-api-0-project-overview",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/$",
        ProjectReleasesEndpoint.as_view(),
        name="sentry-api-0-project-releases",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/release-thresholds/$",
        ReleaseThresholdEndpoint.as_view(),
        name="sentry-api-0-project-release-thresholds",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/release-thresholds/(?P<release_threshold>[^/]+)/$",
        ReleaseThresholdDetailsEndpoint.as_view(),
        name="sentry-api-0-project-release-thresholds-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/commits/$",
        ProjectCommitsEndpoint.as_view(),
        name="sentry-api-0-project-commits",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/token/$",
        ProjectReleasesTokenEndpoint.as_view(),
        name="sentry-api-0-project-releases-token",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/completion/$",
        ProjectReleaseSetupCompletionEndpoint.as_view(),
        name="sentry-api-0-project-releases-completion-status",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/$",
        ProjectReleaseDetailsEndpoint.as_view(),
        name="sentry-api-0-project-release-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/commits/$",
        ProjectReleaseCommitsEndpoint.as_view(),
        name="sentry-api-0-project-release-commits",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/repositories/$",
        ProjectReleaseRepositories.as_view(),
        name="sentry-api-0-project-release-repositories",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/resolved/$",
        ProjectIssuesResolvedInReleaseEndpoint.as_view(),
        name="sentry-api-0-project-release-resolved",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/stats/$",
        ProjectReleaseStatsEndpoint.as_view(),
        name="sentry-api-0-project-release-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/artifact-bundles/(?P<bundle_id>[^/]+)/files/$",
        ProjectArtifactBundleFilesEndpoint.as_view(),
        name="sentry-api-0-project-artifact-bundle-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/artifact-bundles/(?P<bundle_id>[^/]+)/files/(?P<file_id>[^/]+)/$",
        ProjectArtifactBundleFileDetailsEndpoint.as_view(),
        name="sentry-api-0-project-artifact-bundle-file-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/files/$",
        ProjectReleaseFilesEndpoint.as_view(),
        name="sentry-api-0-project-release-files",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/releases/(?P<version>[^/]+)/files/(?P<file_id>[^/]+)/$",
        ProjectReleaseFileDetailsEndpoint.as_view(),
        name="sentry-api-0-project-release-file-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/artifact-lookup/$",
        ProjectArtifactLookupEndpoint.as_view(),
        name="sentry-api-0-project-artifact-lookup",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rules/$",
        ProjectRulesEndpoint.as_view(),
        name="sentry-api-0-project-rules",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/replays/(?P<replay_id>[^/]+)/$",
        ProjectReplayDetailsEndpoint.as_view(),
        name="sentry-api-0-project-replay-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/replays/(?P<replay_id>[^/]+)/viewed-by/$",
        ProjectReplayViewedByEndpoint.as_view(),
        name="sentry-api-0-project-replay-viewed-by",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/replays/(?P<replay_id>[^/]+)/clicks/$",
        ProjectReplayClicksIndexEndpoint.as_view(),
        name="sentry-api-0-project-replay-clicks-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/replays/(?P<replay_id>[^/]+)/recording-segments/$",
        ProjectReplayRecordingSegmentIndexEndpoint.as_view(),
        name="sentry-api-0-project-replay-recording-segment-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/replays/(?P<replay_id>[^/]+)/summarize/$",
        ProjectReplaySummaryEndpoint.as_view(),
        name="sentry-api-0-project-replay-summary",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/replays/(?P<replay_id>[^/]+)/recording-segments/(?P<segment_id>\d+)/$",
        ProjectReplayRecordingSegmentDetailsEndpoint.as_view(),
        name="sentry-api-0-project-replay-recording-segment-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/replays/(?P<replay_id>[^/]+)/videos/(?P<segment_id>\d+)/$",
        ProjectReplayVideoDetailsEndpoint.as_view(),
        name="sentry-api-0-project-replay-video-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/replays/jobs/delete/$",
        ProjectReplayDeletionJobsIndexEndpoint.as_view(),
        name="sentry-api-0-project-replay-deletion-jobs-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/replays/jobs/delete/(?P<job_id>\d+)/$",
        ProjectReplayDeletionJobDetailEndpoint.as_view(),
        name="sentry-api-0-project-replay-deletion-job-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rules/configuration/$",
        ProjectRulesConfigurationEndpoint.as_view(),
        name="sentry-api-0-project-rules-configuration",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rules/(?P<rule_id>\d+)/$",
        ProjectRuleDetailsEndpoint.as_view(),
        name="sentry-api-0-project-rule-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rules/(?P<rule_id>[^/]+)/enable/$",
        ProjectRuleEnableEndpoint.as_view(),
        name="sentry-api-0-project-rule-enable",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rules/(?P<rule_id>[^/]+)/snooze/$",
        RuleSnoozeEndpoint.as_view(),
        name="sentry-api-0-rule-snooze",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/alert-rules/(?P<rule_id>[^/]+)/snooze/$",
        MetricRuleSnoozeEndpoint.as_view(),
        name="sentry-api-0-metric-rule-snooze",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rules/preview/$",
        ProjectRulePreviewEndpoint.as_view(),
        name="sentry-api-0-project-rule-preview",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rule-actions/$",
        ProjectRuleActionsEndpoint.as_view(),
        name="sentry-api-0-project-rule-actions",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rules/(?P<rule_id>[^/]+)/group-history/$",
        ProjectRuleGroupHistoryIndexEndpoint.as_view(),
        name="sentry-api-0-project-rule-group-history-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rules/(?P<rule_id>[^/]+)/stats/$",
        ProjectRuleStatsIndexEndpoint.as_view(),
        name="sentry-api-0-project-rule-stats-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/rule-task/(?P<task_uuid>[^/]+)/$",
        ProjectRuleTaskDetailsEndpoint.as_view(),
        name="sentry-api-0-project-rule-task-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/stats/$",
        ProjectStatsEndpoint.as_view(),
        name="sentry-api-0-project-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/symbol-sources/$",
        ProjectSymbolSourcesEndpoint.as_view(),
        name="sentry-api-0-project-symbol-sources",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/tags/$",
        ProjectTagsEndpoint.as_view(),
        name="sentry-api-0-project-tags",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/tags/(?P<key>[^/]+)/$",
        ProjectTagKeyDetailsEndpoint.as_view(),
        name="sentry-api-0-project-tagkey-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/tags/(?P<key>[^/]+)/values/$",
        ProjectTagKeyValuesEndpoint.as_view(),
        name="sentry-api-0-project-tagkey-values",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/teams/$",
        ProjectTeamsEndpoint.as_view(),
        name="sentry-api-0-project-teams",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/teams/(?P<team_id_or_slug>[^/]+)/$",
        ProjectTeamDetailsEndpoint.as_view(),
        name="sentry-api-0-project-team-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/transfer/$",
        ProjectTransferEndpoint.as_view(),
        name="sentry-api-0-project-transfer",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/users/$",
        ProjectUsersEndpoint.as_view(),
        name="sentry-api-0-project-users",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/(?:user-feedback|user-reports)/$",
        ProjectUserReportsEndpoint.as_view(),
        name="sentry-api-0-project-user-reports",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/user-stats/$",
        ProjectUserStatsEndpoint.as_view(),
        name="sentry-api-0-project-userstats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/reprocessing/$",
        ProjectReprocessingEndpoint.as_view(),
        name="sentry-api-0-project-reprocessing",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/ownership/$",
        ProjectOwnershipEndpoint.as_view(),
        name="sentry-api-0-project-ownership",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/codeowners/$",
        ProjectCodeOwnersEndpoint.as_view(),
        name="sentry-api-0-project-codeowners",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/codeowners/(?P<codeowners_id>[^/]+)/$",
        ProjectCodeOwnersDetailsEndpoint.as_view(),
        name="sentry-api-0-project-codeowners-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/transaction-threshold/configure/$",
        ProjectTransactionThresholdEndpoint.as_view(),
        name="sentry-api-0-project-transaction-threshold",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/performance-issues/configure/$",
        ProjectPerformanceIssueSettingsEndpoint.as_view(),
        name="sentry-api-0-project-performance-issue-settings",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/performance/configure/$",
        ProjectPerformanceGeneralSettingsEndpoint.as_view(),
        name="sentry-api-0-project-performance-general-settings",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/web-vitals-detector/$",
        ProjectWebVitalsDetectionEndpoint.as_view(),
        name="sentry-api-0-project-web-vitals-detection",
    ),
    # Load plugin project urls
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/plugins/$",
        ProjectPluginsEndpoint.as_view(),
        name="sentry-api-0-project-plugins",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/plugins/(?P<plugin_id>[^/]+)/$",
        ProjectPluginDetailsEndpoint.as_view(),
        name="sentry-api-0-project-plugin-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/cluster-transaction-names/$",
        ProjectTransactionNamesCluster.as_view(),
        name="sentry-api-0-organization-project-cluster-transaction-names",
    ),
    # Tombstone
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/tombstones/$",
        GroupTombstoneEndpoint.as_view(),
        name="sentry-api-0-group-tombstones",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/tombstones/(?P<tombstone_id>\d+)/$",
        GroupTombstoneDetailsEndpoint.as_view(),
        name="sentry-api-0-group-tombstone-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/stacktrace-coverage/$",
        ProjectStacktraceCoverageEndpoint.as_view(),
        name="sentry-api-0-project-stacktrace-coverage",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/stacktrace-link/$",
        ProjectStacktraceLinkEndpoint.as_view(),
        name="sentry-api-0-project-stacktrace-link",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/repo-path-parsing/$",
        ProjectRepoPathParsingEndpoint.as_view(),
        name="sentry-api-0-project-repo-path-parsing",
    ),
    # Grouping configs
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/grouping-configs/$",
        ProjectGroupingConfigsEndpoint.as_view(),
        name="sentry-api-0-project-grouping-configs",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/profiling/profiles/(?P<profile_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        ProjectProfilingProfileEndpoint.as_view(),
        name="sentry-api-0-project-profiling-profile",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/profiling/raw_profiles/(?P<profile_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        ProjectProfilingRawProfileEndpoint.as_view(),
        name="sentry-api-0-project-profiling-raw-profile",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/profiling/raw_chunks/(?P<profiler_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/(?P<chunk_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
        ProjectProfilingRawChunkEndpoint.as_view(),
        name="sentry-api-0-project-profiling-raw-chunk",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/statistical-detector/$",
        ProjectStatisticalDetectors.as_view(),
        name="sentry-api-0-project-statistical-detector",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/monitors/(?P<monitor_id_or_slug>[^/]+)/$",
        ProjectMonitorDetailsEndpoint.as_view(),
        name="sentry-api-0-project-monitor-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/monitors/(?P<monitor_id_or_slug>[^/]+)/checkins/$",
        ProjectMonitorCheckInIndexEndpoint.as_view(),
        name="sentry-api-0-project-monitor-check-in-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/monitors/(?P<monitor_id_or_slug>[^/]+)/environments/(?P<environment>[^/]+)/$",
        ProjectMonitorEnvironmentDetailsEndpoint.as_view(),
        name="sentry-api-0-project-monitor-environment-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/processing-errors/(?P<uuid>[^/]+)/$",
        ProjectProcessingErrorsDetailsEndpoint.as_view(),
        name="sentry-api-0-project-processing-errors-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/processing-errors/$",
        ProjectProcessingErrorsIndexEndpoint.as_view(),
        name="sentry-api-0-project-processing-errors-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/monitors/(?P<monitor_id_or_slug>[^/]+)/processing-errors/$",
        ProjectMonitorProcessingErrorsIndexEndpoint.as_view(),
        name="sentry-api-0-project-monitor-processing-errors-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/monitors/(?P<monitor_id_or_slug>[^/]+)/stats/$",
        ProjectMonitorStatsEndpoint.as_view(),
        name="sentry-api-0-project-monitor-stats",
    ),
    # Uptime
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/uptime/$",
        ProjectUptimeAlertIndexEndpoint.as_view(),
        name="sentry-api-0-project-uptime-alert-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/uptime/(?P<uptime_detector_id>[^/]+)/$",
        ProjectUptimeAlertDetailsEndpoint.as_view(),
        name="sentry-api-0-project-uptime-alert-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/uptime/(?P<uptime_detector_id>[^/]+)/checks/$",
        ProjectUptimeAlertCheckIndexEndpoint.as_view(),
        name="sentry-api-0-project-uptime-alert-checks",
    ),
    # Tempest
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/tempest-credentials/$",
        TempestCredentialsEndpoint.as_view(),
        name="sentry-api-0-project-tempest-credentials",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/tempest-credentials/(?P<tempest_credentials_id>\d+)/$",
        TempestCredentialsDetailsEndpoint.as_view(),
        name="sentry-api-0-project-tempest-credentials-details",
    ),
    # Seer
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/seer/preferences/$",
        ProjectSeerPreferencesEndpoint.as_view(),
        name="sentry-api-0-project-seer-preferences",
    ),
    # User Issue
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/user-issue/$",
        ProjectUserIssueEndpoint.as_view(),
        name="sentry-api-0-project-user-issue",
    ),
    *preprod_urls.preprod_urlpatterns,
]

TEAM_URLS = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/$",
        TeamDetailsEndpoint.as_view(),
        name="sentry-api-0-team-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/issues/old/$",
        TeamGroupsOldEndpoint.as_view(),
        name="sentry-api-0-team-oldest-issues",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/release-count/$",
        TeamReleaseCountEndpoint.as_view(),
        name="sentry-api-0-team-release-count",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/time-to-resolution/$",
        TeamTimeToResolutionEndpoint.as_view(),
        name="sentry-api-0-team-time-to-resolution",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/unresolved-issue-age/$",
        TeamUnresolvedIssueAgeEndpoint.as_view(),
        name="sentry-api-0-team-unresolved-issue-age",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/alerts-triggered/$",
        TeamAlertsTriggeredTotalsEndpoint.as_view(),
        name="sentry-api-0-team-alerts-triggered",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/alerts-triggered-index/$",
        TeamAlertsTriggeredIndexEndpoint.as_view(),
        name="sentry-api-0-team-alerts-triggered-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/issue-breakdown/$",
        TeamIssueBreakdownEndpoint.as_view(),
        name="sentry-api-0-team-issue-breakdown",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/all-unresolved-issues/$",
        TeamAllUnresolvedIssuesEndpoint.as_view(),
        name="sentry-api-0-team-all-unresolved-issues",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/members/$",
        TeamMembersEndpoint.as_view(),
        name="sentry-api-0-team-members",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/projects/$",
        TeamProjectsEndpoint.as_view(),
        name="sentry-api-0-team-project-index",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/stats/$",
        TeamStatsEndpoint.as_view(),
        name="sentry-api-0-team-stats",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/external-teams/$",
        ExternalTeamEndpoint.as_view(),
        name="sentry-api-0-external-team",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/(?P<team_id_or_slug>[^/]+)/external-teams/(?P<external_team_id>[^/]+)/$",
        ExternalTeamDetailsEndpoint.as_view(),
        name="sentry-api-0-external-team-details",
    ),
]

SENTRY_APP_URLS = [
    re_path(
        r"^$",
        SentryAppsEndpoint.as_view(),
        name="sentry-api-0-sentry-apps",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/$",
        SentryAppDetailsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-details",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/features/$",
        SentryAppFeaturesEndpoint.as_view(),
        name="sentry-api-0-sentry-app-features",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/components/$",
        SentryAppComponentsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-components",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/avatar/$",
        SentryAppAvatarEndpoint.as_view(),
        name="sentry-api-0-sentry-app-avatar",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/api-tokens/$",
        SentryInternalAppTokensEndpoint.as_view(),
        name="sentry-api-0-sentry-internal-app-tokens",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/api-tokens/(?P<api_token_id>[^/]+)/$",
        SentryInternalAppTokenDetailsEndpoint.as_view(),
        name="sentry-api-0-sentry-internal-app-token-details",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/rotate-secret/$",
        SentryAppRotateSecretEndpoint.as_view(),
        name="sentry-api-0-sentry-app-rotate-secret",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/stats/$",
        SentryAppStatsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-stats",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/publish-request/$",
        SentryAppPublishRequestEndpoint.as_view(),
        name="sentry-api-0-sentry-app-publish-request",
    ),
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/webhook-requests/$",
        SentryAppWebhookRequestsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-webhook-requests",
    ),
    # The following a region endpoints as interactions and request logs
    # are per-region.
    re_path(
        r"^(?P<sentry_app_id_or_slug>[^/]+)/interaction/$",
        SentryAppInteractionEndpoint.as_view(),
        name="sentry-api-0-sentry-app-interaction",
    ),
]

SENTRY_APP_INSTALLATION_URLS = [
    re_path(
        r"^(?P<uuid>[^/]+)/$",
        SentryAppInstallationDetailsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-details",
    ),
    re_path(
        r"^(?P<uuid>[^/]+)/authorizations/$",
        SentryAppAuthorizationsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-authorizations",
    ),
    # The following endpoints are region scoped, not control
    # like most of sentryapps.
    re_path(
        r"^(?P<uuid>[^/]+)/external-requests/$",
        SentryAppInstallationExternalRequestsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-external-requests",
    ),
    re_path(
        r"^(?P<uuid>[^/]+)/external-issue-actions/$",
        SentryAppInstallationExternalIssueActionsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-external-issue-actions",
    ),
    re_path(
        r"^(?P<uuid>[^/]+)/external-issues/$",
        SentryAppInstallationExternalIssuesEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-external-issues",
    ),
    re_path(
        r"^(?P<uuid>[^/]+)/external-issues/(?P<external_issue_id>[^/]+)/$",
        SentryAppInstallationExternalIssueDetailsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-external-issue-details",
    ),
    re_path(
        r"^(?P<uuid>[^/]+)/service-hook-projects/$",
        SentryAppInstallationServiceHookProjectsEndpoint.as_view(),
        name="sentry-api-0-sentry-app-installation-service-hook-projects",
    ),
]

INTERNAL_URLS = [
    re_path(
        r"^health/$",
        SystemHealthEndpoint.as_view(),
        name="sentry-api-0-system-health",
    ),
    re_path(
        r"^options/$",
        SystemOptionsEndpoint.as_view(),
        name="sentry-api-0-system-options",
    ),
    re_path(
        r"^beacon/$",
        InternalBeaconEndpoint.as_view(),
        name="sentry-api-0-internal-beacon",
    ),
    re_path(
        r"^frontend-version/$",
        FrontendVersionEndpoint.as_view(),
        name="sentry-api-0-internal-frontend-version",
    ),
    re_path(
        r"^warnings/$",
        InternalWarningsEndpoint.as_view(),
        name="sentry-api-0-internal-warnings",
    ),
    re_path(
        r"^packages/$",
        InternalPackagesEndpoint.as_view(),
        name="sentry-api-0-internal-packages",
    ),
    re_path(
        r"^environment/$",
        InternalEnvironmentEndpoint.as_view(),
        name="sentry-api-0-internal-environment",
    ),
    re_path(
        r"^mail/$",
        InternalMailEndpoint.as_view(),
        name="sentry-api-0-internal-mail",
    ),
    re_path(
        r"^project-config/$",
        AdminRelayProjectConfigsEndpoint.as_view(),
        name="sentry-api-0-internal-project-config",
    ),
    re_path(
        # If modifying, ensure PROXY_BASE_PATH is updated as well
        r"^integration-proxy/$",
        InternalIntegrationProxyEndpoint.as_view(),
        name="sentry-api-0-internal-integration-proxy",
    ),
    re_path(
        r"^rpc/(?P<service_name>\w+)/(?P<method_name>\w+)/$",
        InternalRpcServiceEndpoint.as_view(),
        name="sentry-api-0-rpc-service",
    ),
    re_path(
        r"^seer-rpc/(?P<method_name>\w+)/$",
        SeerRpcServiceEndpoint.as_view(),
        name="sentry-api-0-seer-rpc-service",
    ),
    # Prevent AI (Overwatch) endpoints
    re_path(
        r"^prevent/pr-review/configs/resolved/$",
        PreventPrReviewResolvedConfigsEndpoint.as_view(),
        name="sentry-api-0-prevent-pr-review-configs-resolved",
    ),
    re_path(
        r"^prevent/pr-review/eligibility/$",
        PreventPrReviewEligibilityEndpoint.as_view(),
        name="sentry-api-0-prevent-pr-review-eligibility",
    ),
    re_path(
        r"^prevent/pr-review/github/sentry-org/$",
        PreventPrReviewSentryOrgEndpoint.as_view(),
        name="sentry-api-0-prevent-pr-review-github-sentry-org",
    ),
    re_path(
        r"^code-review/repo-settings/$",
        CodeReviewRepoSettingsEndpoint.as_view(),
        name="sentry-api-0-code-review-repo-settings",
    ),
    re_path(
        r"^feature-flags/$",
        InternalFeatureFlagsEndpoint.as_view(),
        name="sentry-api-0-internal-feature-flags",
    ),
    re_path(
        r"^feature-flags/ea-feature-flags$",
        InternalEAFeaturesEndpoint.as_view(),
        name="sentry-api-0-internal-ea-features",
    ),
    re_path(
        r"^demo/email-capture/$",
        EmailCaptureEndpoint.as_view(),
        name="sentry-demo-mode-email-capture",
    ),
    *preprod_urls.preprod_internal_urlpatterns,
    *notification_platform_urls.internal_urlpatterns,
]

urlpatterns = [
    # Relay
    re_path(
        r"^relays/",
        include(RELAY_URLS),
    ),
    # Groups / Issues
    re_path(
        r"^(?:issues|groups)/",
        include(create_group_urls("sentry-api-0")),
    ),
    # Organizations
    re_path(
        r"^organizations/",
        include(ORGANIZATION_URLS),
    ),
    # Projects
    re_path(
        r"^projects/",
        include(PROJECT_URLS),
    ),
    # Teams
    re_path(
        r"^teams/",
        include(TEAM_URLS),
    ),
    # Users
    re_path(
        r"^users/",
        include(USER_URLS),
    ),
    # UserRoles
    re_path(
        r"^userroles/",
        include(USER_ROLE_URLS),
    ),
    # Sentry Apps
    re_path(
        r"^sentry-apps/",
        include(SENTRY_APP_URLS),
    ),
    # Toplevel app installs
    re_path(
        r"^sentry-app-installations/",
        include(SENTRY_APP_INSTALLATION_URLS),
    ),
    # Auth
    re_path(
        r"^auth/",
        include(AUTH_URLS),
    ),
    # Auth
    re_path(
        r"^auth-v2/",
        include(AUTH_V2_URLS),
    ),
    # Broadcasts
    re_path(
        r"^broadcasts/",
        include(BROADCAST_URLS),
    ),
    #
    #
    #
    re_path(
        r"^assistant/$",
        AssistantEndpoint.as_view(),
        name="sentry-api-0-assistant",
    ),
    re_path(
        r"^api-applications/$",
        ApiApplicationsEndpoint.as_view(),
        name="sentry-api-0-api-applications",
    ),
    re_path(
        r"^api-applications/(?P<app_id>[^/]+)/$",
        ApiApplicationDetailsEndpoint.as_view(),
        name="sentry-api-0-api-application-details",
    ),
    re_path(
        r"^api-applications/(?P<app_id>[^/]+)/rotate-secret/$",
        ApiApplicationRotateSecretEndpoint.as_view(),
        name="sentry-api-0-api-application-rotate-secret",
    ),
    re_path(
        r"^api-authorizations/$",
        ApiAuthorizationsEndpoint.as_view(),
        name="sentry-api-0-api-authorizations",
    ),
    re_path(
        r"^api-tokens/$",
        ApiTokensEndpoint.as_view(),
        name="sentry-api-0-api-tokens",
    ),
    re_path(
        r"^api-tokens/(?P<token_id>[^/]+)/$",
        ApiTokenDetailsEndpoint.as_view(),
        name="sentry-api-0-api-token-details",
    ),
    re_path(
        r"^seer/models/$",
        SeerModelsEndpoint.as_view(),
        name="sentry-api-0-seer-models",
    ),
    # List Authenticators
    re_path(
        r"^authenticators/$",
        AuthenticatorIndexEndpoint.as_view(),
        name="sentry-api-0-authenticator-index",
    ),
    # Project transfer
    re_path(
        r"^accept-transfer/$",
        AcceptProjectTransferEndpoint.as_view(),
        name="sentry-api-0-accept-project-transfer",
    ),
    # Organization invite
    re_path(
        r"^accept-invite/(?P<organization_id_or_slug>[^/]+)/(?P<member_id>[^/]+)/(?P<token>[^/]+)/$",
        AcceptOrganizationInvite.as_view(),
        name="sentry-api-0-organization-accept-organization-invite",
    ),
    re_path(
        r"^data-export/notifications/google-cloud/$",
        DataExportNotificationsEndpoint.as_view(),
        name="sentry-api-0-data-export-notifications",
    ),
    re_path(
        r"^accept-invite/(?P<member_id>[^/]+)/(?P<token>[^/]+)/$",
        AcceptOrganizationInvite.as_view(),
        name="sentry-api-0-accept-organization-invite",
    ),
    re_path(
        r"^notification-defaults/$",
        NotificationDefaultsEndpoints.as_view(),
        name="sentry-api-0-notification-defaults",
    ),
    re_path(
        r"^sentry-apps-stats/$",
        SentryAppsStatsEndpoint.as_view(),
        name="sentry-api-0-sentry-apps-stats",
    ),
    # Document Integrations
    re_path(
        r"^doc-integrations/$",
        DocIntegrationsEndpoint.as_view(),
        name="sentry-api-0-doc-integrations",
    ),
    re_path(
        r"^doc-integrations/(?P<doc_integration_id_or_slug>[^/]+)/$",
        DocIntegrationDetailsEndpoint.as_view(),
        name="sentry-api-0-doc-integration-details",
    ),
    re_path(
        r"^doc-integrations/(?P<doc_integration_id_or_slug>[^/]+)/avatar/$",
        DocIntegrationAvatarEndpoint.as_view(),
        name="sentry-api-0-doc-integration-avatar",
    ),
    # Integration Features
    re_path(
        r"^integration-features/$",
        IntegrationFeaturesEndpoint.as_view(),
        name="sentry-api-0-integration-features",
    ),
    # Project Wizard
    re_path(
        r"^wizard/$",
        SetupWizard.as_view(),
        name="sentry-api-0-project-wizard-new",
    ),
    re_path(
        r"^wizard/(?P<wizard_hash>[^/]+)/$",
        SetupWizard.as_view(),
        name="sentry-api-0-project-wizard",
    ),
    # Internal
    re_path(
        r"^internal/",
        include(INTERNAL_URLS),
    ),
    # Relocations
    re_path(
        r"^relocations/",
        include(RELOCATION_URLS),
    ),
    re_path(
        r"^publickeys/relocations/$",
        RelocationPublicKeyEndpoint.as_view(),
        name="sentry-api-0-relocations-public-key",
    ),
    # Uptime checker public IP address list
    re_path(
        r"^uptime-ips/$",
        UptimeIpsEndpoint.as_view(),
        name="sentry-api-0-uptime-ips",
    ),
    # Tempest public IP address list
    re_path(
        r"^tempest-ips/$",
        TempestIpsEndpoint.as_view(),
        name="sentry-api-0-tempest-ips",
    ),
    # Secret Scanning
    re_path(
        r"^secret-scanning/github/$",
        SecretScanningGitHubEndpoint.as_view(),
        name="sentry-api-0-secret-scanning-github",
    ),
    # Catch all
    re_path(
        r"^$",
        IndexEndpoint.as_view(),
        name="sentry-api-index",
    ),
    re_path(
        r"^",
        CatchallEndpoint.as_view(),
        name="sentry-api-catchall",
    ),
    # re_path(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework'))
]
