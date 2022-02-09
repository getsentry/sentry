import sentry.api.endpoints.accept_organization_invite
import sentry.api.endpoints.accept_project_transfer
import sentry.api.endpoints.api_application_details
import sentry.api.endpoints.api_applications
import sentry.api.endpoints.api_authorizations
import sentry.api.endpoints.api_tokens
import sentry.api.endpoints.assistant
import sentry.api.endpoints.auth_config
import sentry.api.endpoints.auth_index
import sentry.api.endpoints.auth_login
import sentry.api.endpoints.authenticator_index
import sentry.api.endpoints.broadcast_details
import sentry.api.endpoints.broadcast_index
import sentry.api.endpoints.builtin_symbol_sources
import sentry.api.endpoints.chunk
import sentry.api.endpoints.data_scrubbing_selector_suggestions
import sentry.api.endpoints.debug_files
import sentry.api.endpoints.doc_integration_avatar
import sentry.api.endpoints.doc_integration_details
import sentry.api.endpoints.doc_integrations
import sentry.api.endpoints.event_apple_crash_report
import sentry.api.endpoints.event_attachment_details
import sentry.api.endpoints.event_attachments
import sentry.api.endpoints.event_file_committers
import sentry.api.endpoints.event_grouping_info
import sentry.api.endpoints.event_owners
import sentry.api.endpoints.event_reprocessable
import sentry.api.endpoints.external_team
import sentry.api.endpoints.external_team_details
import sentry.api.endpoints.external_user
import sentry.api.endpoints.external_user_details
import sentry.api.endpoints.filechange
import sentry.api.endpoints.group_activities
import sentry.api.endpoints.group_attachments
import sentry.api.endpoints.group_current_release
import sentry.api.endpoints.group_details
import sentry.api.endpoints.group_events
import sentry.api.endpoints.group_events_latest
import sentry.api.endpoints.group_events_oldest
import sentry.api.endpoints.group_external_issue_details
import sentry.api.endpoints.group_external_issues
import sentry.api.endpoints.group_first_last_release
import sentry.api.endpoints.group_hashes
import sentry.api.endpoints.group_hashes_split
import sentry.api.endpoints.group_integration_details
import sentry.api.endpoints.group_integrations
import sentry.api.endpoints.group_notes
import sentry.api.endpoints.group_notes_details
import sentry.api.endpoints.group_participants
import sentry.api.endpoints.group_reprocessing
import sentry.api.endpoints.group_similar_issues
import sentry.api.endpoints.group_stats
import sentry.api.endpoints.group_tagkey_details
import sentry.api.endpoints.group_tagkey_values
import sentry.api.endpoints.group_tags
import sentry.api.endpoints.group_tombstone
import sentry.api.endpoints.group_tombstone_details
import sentry.api.endpoints.group_user_reports
import sentry.api.endpoints.grouping_configs
import sentry.api.endpoints.grouping_level_new_issues
import sentry.api.endpoints.grouping_levels
import sentry.api.endpoints.index
import sentry.api.endpoints.integration_features
import sentry.api.endpoints.internal_beacon
import sentry.api.endpoints.internal_environment
import sentry.api.endpoints.internal_mail
import sentry.api.endpoints.internal_packages
import sentry.api.endpoints.internal_queue_tasks
import sentry.api.endpoints.internal_quotas
import sentry.api.endpoints.internal_stats
import sentry.api.endpoints.internal_warnings
import sentry.api.endpoints.monitor_checkin_details
import sentry.api.endpoints.monitor_checkins
import sentry.api.endpoints.monitor_details
import sentry.api.endpoints.monitor_stats
import sentry.api.endpoints.organization_access_request_details
import sentry.api.endpoints.organization_activity
import sentry.api.endpoints.organization_api_key_details
import sentry.api.endpoints.organization_api_key_index
import sentry.api.endpoints.organization_auditlogs
import sentry.api.endpoints.organization_auth_provider_details
import sentry.api.endpoints.organization_auth_provider_send_reminders
import sentry.api.endpoints.organization_auth_providers
import sentry.api.endpoints.organization_avatar
import sentry.api.endpoints.organization_code_mapping_codeowners
import sentry.api.endpoints.organization_code_mapping_details
import sentry.api.endpoints.organization_code_mappings
import sentry.api.endpoints.organization_codeowners_associations
import sentry.api.endpoints.organization_config_integrations
import sentry.api.endpoints.organization_config_repositories
import sentry.api.endpoints.organization_dashboard_details
import sentry.api.endpoints.organization_dashboard_widget_details
import sentry.api.endpoints.organization_dashboards
import sentry.api.endpoints.organization_details
import sentry.api.endpoints.organization_environments
import sentry.api.endpoints.organization_event_details
import sentry.api.endpoints.organization_eventid
import sentry.api.endpoints.organization_events
import sentry.api.endpoints.organization_events_facets
import sentry.api.endpoints.organization_events_facets_performance
import sentry.api.endpoints.organization_events_has_measurements
import sentry.api.endpoints.organization_events_histogram
import sentry.api.endpoints.organization_events_meta
import sentry.api.endpoints.organization_events_span_ops
import sentry.api.endpoints.organization_events_spans_performance
import sentry.api.endpoints.organization_events_stats
import sentry.api.endpoints.organization_events_trace
import sentry.api.endpoints.organization_events_trends
import sentry.api.endpoints.organization_events_vitals
import sentry.api.endpoints.organization_group_index
import sentry.api.endpoints.organization_group_index_stats
import sentry.api.endpoints.organization_has_mobile_app_events
import sentry.api.endpoints.organization_index
import sentry.api.endpoints.organization_integration_details
import sentry.api.endpoints.organization_integration_repos
import sentry.api.endpoints.organization_integration_request
import sentry.api.endpoints.organization_integration_serverless_functions
import sentry.api.endpoints.organization_integrations
import sentry.api.endpoints.organization_invite_request_details
import sentry.api.endpoints.organization_invite_request_index
import sentry.api.endpoints.organization_issues_count
import sentry.api.endpoints.organization_issues_resolved_in_release
import sentry.api.endpoints.organization_join_request
import sentry.api.endpoints.organization_member_details
import sentry.api.endpoints.organization_member_index
import sentry.api.endpoints.organization_member_issues_assigned
import sentry.api.endpoints.organization_member_issues_bookmarked
import sentry.api.endpoints.organization_member_issues_viewed
import sentry.api.endpoints.organization_member_team_details
import sentry.api.endpoints.organization_member_unreleased_commits
import sentry.api.endpoints.organization_metrics
import sentry.api.endpoints.organization_monitors
import sentry.api.endpoints.organization_onboarding_tasks
import sentry.api.endpoints.organization_pinned_searches
import sentry.api.endpoints.organization_plugins
import sentry.api.endpoints.organization_plugins_configs
import sentry.api.endpoints.organization_processingissues
import sentry.api.endpoints.organization_projects
import sentry.api.endpoints.organization_projects_sent_first_event
import sentry.api.endpoints.organization_recent_searches
import sentry.api.endpoints.organization_relay_usage
import sentry.api.endpoints.organization_release_assemble
import sentry.api.endpoints.organization_release_commits
import sentry.api.endpoints.organization_release_details
import sentry.api.endpoints.organization_release_file_details
import sentry.api.endpoints.organization_release_files
import sentry.api.endpoints.organization_release_meta
import sentry.api.endpoints.organization_release_previous_commits
import sentry.api.endpoints.organization_releases
import sentry.api.endpoints.organization_repositories
import sentry.api.endpoints.organization_repository_commits
import sentry.api.endpoints.organization_repository_details
import sentry.api.endpoints.organization_request_project_creation
import sentry.api.endpoints.organization_sdk_updates
import sentry.api.endpoints.organization_search_details
import sentry.api.endpoints.organization_searches
import sentry.api.endpoints.organization_sentry_apps
import sentry.api.endpoints.organization_sessions
import sentry.api.endpoints.organization_shortid
import sentry.api.endpoints.organization_slugs
import sentry.api.endpoints.organization_stats
import sentry.api.endpoints.organization_stats_v2
import sentry.api.endpoints.organization_tagkey_values
import sentry.api.endpoints.organization_tags
import sentry.api.endpoints.organization_teams
import sentry.api.endpoints.organization_user_details
import sentry.api.endpoints.organization_user_issues
import sentry.api.endpoints.organization_user_issues_search
import sentry.api.endpoints.organization_user_reports
import sentry.api.endpoints.organization_user_teams
import sentry.api.endpoints.organization_users
import sentry.api.endpoints.project_agnostic_rule_conditions
import sentry.api.endpoints.project_app_store_connect_credentials
import sentry.api.endpoints.project_avatar
import sentry.api.endpoints.project_codeowners
import sentry.api.endpoints.project_codeowners_details
import sentry.api.endpoints.project_codeowners_request
import sentry.api.endpoints.project_create_sample
import sentry.api.endpoints.project_create_sample_transaction
import sentry.api.endpoints.project_details
import sentry.api.endpoints.project_docs_platform
import sentry.api.endpoints.project_environment_details
import sentry.api.endpoints.project_environments
import sentry.api.endpoints.project_event_details
import sentry.api.endpoints.project_events
import sentry.api.endpoints.project_filter_details
import sentry.api.endpoints.project_filters
import sentry.api.endpoints.project_group_index
import sentry.api.endpoints.project_group_stats
import sentry.api.endpoints.project_grouping_configs
import sentry.api.endpoints.project_index
import sentry.api.endpoints.project_issues_resolved_in_release
import sentry.api.endpoints.project_key_details
import sentry.api.endpoints.project_key_stats
import sentry.api.endpoints.project_keys
import sentry.api.endpoints.project_member_index
import sentry.api.endpoints.project_ownership
import sentry.api.endpoints.project_platforms
import sentry.api.endpoints.project_plugin_details
import sentry.api.endpoints.project_plugins
import sentry.api.endpoints.project_processingissues
import sentry.api.endpoints.project_release_commits
import sentry.api.endpoints.project_release_details
import sentry.api.endpoints.project_release_file_details
import sentry.api.endpoints.project_release_files
import sentry.api.endpoints.project_release_repositories
import sentry.api.endpoints.project_release_setup
import sentry.api.endpoints.project_release_stats
import sentry.api.endpoints.project_releases
import sentry.api.endpoints.project_releases_token
import sentry.api.endpoints.project_repo_path_parsing
import sentry.api.endpoints.project_reprocessing
import sentry.api.endpoints.project_rule_details
import sentry.api.endpoints.project_rule_task_details
import sentry.api.endpoints.project_rules
import sentry.api.endpoints.project_rules_configuration
import sentry.api.endpoints.project_search_details
import sentry.api.endpoints.project_searches
import sentry.api.endpoints.project_servicehook_details
import sentry.api.endpoints.project_servicehook_stats
import sentry.api.endpoints.project_servicehooks
import sentry.api.endpoints.project_stacktrace_link
import sentry.api.endpoints.project_stats
import sentry.api.endpoints.project_tagkey_details
import sentry.api.endpoints.project_tagkey_values
import sentry.api.endpoints.project_tags
import sentry.api.endpoints.project_team_details
import sentry.api.endpoints.project_teams
import sentry.api.endpoints.project_transaction_threshold
import sentry.api.endpoints.project_transaction_threshold_override
import sentry.api.endpoints.project_transfer
import sentry.api.endpoints.project_user_details
import sentry.api.endpoints.project_user_reports
import sentry.api.endpoints.project_user_stats
import sentry.api.endpoints.project_users
import sentry.api.endpoints.prompts_activity
import sentry.api.endpoints.relay_details
import sentry.api.endpoints.relay_healthcheck
import sentry.api.endpoints.relay_index
import sentry.api.endpoints.relay_projectconfigs
import sentry.api.endpoints.relay_projectids
import sentry.api.endpoints.relay_publickeys
import sentry.api.endpoints.relay_register
import sentry.api.endpoints.release_deploys
import sentry.api.endpoints.sentry_app_authorizations
import sentry.api.endpoints.sentry_app_avatar
import sentry.api.endpoints.sentry_app_components
import sentry.api.endpoints.sentry_app_details
import sentry.api.endpoints.sentry_app_features
import sentry.api.endpoints.sentry_app_installation_details
import sentry.api.endpoints.sentry_app_installation_external_issue_actions
import sentry.api.endpoints.sentry_app_installation_external_issue_details
import sentry.api.endpoints.sentry_app_installation_external_issues
import sentry.api.endpoints.sentry_app_installation_external_requests
import sentry.api.endpoints.sentry_app_installations
import sentry.api.endpoints.sentry_app_interaction
import sentry.api.endpoints.sentry_app_publish_request
import sentry.api.endpoints.sentry_app_requests
import sentry.api.endpoints.sentry_app_stats
import sentry.api.endpoints.sentry_apps
import sentry.api.endpoints.sentry_apps_stats
import sentry.api.endpoints.sentry_internal_app_token_details
import sentry.api.endpoints.sentry_internal_app_tokens
import sentry.api.endpoints.setup_wizard
import sentry.api.endpoints.shared_group_details
import sentry.api.endpoints.system_health
import sentry.api.endpoints.system_options
import sentry.api.endpoints.team_alerts_triggered
import sentry.api.endpoints.team_all_unresolved_issues
import sentry.api.endpoints.team_avatar
import sentry.api.endpoints.team_details
import sentry.api.endpoints.team_groups_old
import sentry.api.endpoints.team_issue_breakdown
import sentry.api.endpoints.team_members
import sentry.api.endpoints.team_notification_settings_details
import sentry.api.endpoints.team_projects
import sentry.api.endpoints.team_release_count
import sentry.api.endpoints.team_stats
import sentry.api.endpoints.team_time_to_resolution
import sentry.api.endpoints.team_unresolved_issue_age
import sentry.api.endpoints.user_authenticator_details
import sentry.api.endpoints.user_authenticator_enroll
import sentry.api.endpoints.user_authenticator_index
import sentry.api.endpoints.user_details
import sentry.api.endpoints.user_emails
import sentry.api.endpoints.user_emails_confirm
import sentry.api.endpoints.user_identity
import sentry.api.endpoints.user_identity_config
import sentry.api.endpoints.user_identity_details
import sentry.api.endpoints.user_index
import sentry.api.endpoints.user_ips
import sentry.api.endpoints.user_notification_details
import sentry.api.endpoints.user_notification_fine_tuning
import sentry.api.endpoints.user_notification_settings_details
import sentry.api.endpoints.user_organizationintegrations
import sentry.api.endpoints.user_organizations
import sentry.api.endpoints.user_password
import sentry.api.endpoints.user_permission_details
import sentry.api.endpoints.user_permissions
import sentry.api.endpoints.user_permissions_config
import sentry.api.endpoints.user_role_details
import sentry.api.endpoints.user_roles
import sentry.api.endpoints.user_social_identities_index
import sentry.api.endpoints.user_social_identity_details
import sentry.api.endpoints.user_subscriptions
import sentry.api.endpoints.useravatar
import sentry.api.endpoints.userroles_details
import sentry.api.endpoints.userroles_index
import sentry.data_export.endpoints.data_export
import sentry.data_export.endpoints.data_export_details
import sentry.discover.endpoints.discover_key_transactions
import sentry.discover.endpoints.discover_query
import sentry.discover.endpoints.discover_saved_queries
import sentry.discover.endpoints.discover_saved_query_detail
import sentry.incidents.endpoints.organization_alert_rule_available_action_index
import sentry.incidents.endpoints.organization_alert_rule_details
import sentry.incidents.endpoints.organization_alert_rule_index
import sentry.incidents.endpoints.organization_incident_activity_index
import sentry.incidents.endpoints.organization_incident_comment_details
import sentry.incidents.endpoints.organization_incident_comment_index
import sentry.incidents.endpoints.organization_incident_details
import sentry.incidents.endpoints.organization_incident_index
import sentry.incidents.endpoints.organization_incident_seen
import sentry.incidents.endpoints.organization_incident_subscription_index
import sentry.incidents.endpoints.project_alert_rule_details
import sentry.incidents.endpoints.project_alert_rule_index
import sentry.incidents.endpoints.project_alert_rule_task_details
import sentry.integrations.bitbucket.descriptor
import sentry.integrations.bitbucket.installed
import sentry.integrations.bitbucket.search
import sentry.integrations.bitbucket.uninstalled
import sentry.integrations.cloudflare.metadata
import sentry.integrations.cloudflare.webhook
import sentry.integrations.github.search
import sentry.integrations.gitlab.search
import sentry.integrations.jira.descriptor
import sentry.integrations.jira.installed
import sentry.integrations.jira.search
import sentry.integrations.jira.uninstalled
import sentry.integrations.jira.webhooks
import sentry.integrations.jira_server.search
import sentry.integrations.jira_server.webhooks
import sentry.integrations.msteams.webhook
import sentry.integrations.slack.endpoints.action
import sentry.integrations.slack.endpoints.command
import sentry.integrations.slack.endpoints.event
import sentry.integrations.vercel.generic_webhook
import sentry.integrations.vercel.webhook
import sentry.integrations.vsts.search
import sentry.integrations.vsts.webhooks
import sentry.plugins.bases.issue2
import sentry.plugins.endpoints
import sentry.scim.endpoints.members
import sentry.scim.endpoints.schemas
import sentry.scim.endpoints.teams

__PUBLIC_ENDPOINTS_FROM_JSON = {
    sentry.api.endpoints.debug_files.DebugFilesEndpoint,
    sentry.api.endpoints.debug_files.UnknownDebugFilesEndpoint,
    sentry.api.endpoints.external_team_details.ExternalTeamDetailsEndpoint,
    sentry.api.endpoints.filechange.CommitFileChangeEndpoint,
    sentry.api.endpoints.group_details.GroupDetailsEndpoint,
    sentry.api.endpoints.group_events.GroupEventsEndpoint,
    sentry.api.endpoints.group_events_latest.GroupEventsLatestEndpoint,
    sentry.api.endpoints.group_events_oldest.GroupEventsOldestEndpoint,
    sentry.api.endpoints.group_hashes.GroupHashesEndpoint,
    sentry.api.endpoints.group_tagkey_details.GroupTagKeyDetailsEndpoint,
    sentry.api.endpoints.group_tagkey_values.GroupTagKeyValuesEndpoint,
    sentry.api.endpoints.organization_details.OrganizationDetailsEndpoint,
    sentry.api.endpoints.organization_eventid.EventIdLookupEndpoint,
    sentry.api.endpoints.organization_index.OrganizationIndexEndpoint,
    sentry.api.endpoints.organization_member_team_details.OrganizationMemberTeamDetailsEndpoint,
    sentry.api.endpoints.organization_projects.OrganizationProjectsEndpoint,
    sentry.api.endpoints.organization_release_commits.OrganizationReleaseCommitsEndpoint,
    sentry.api.endpoints.organization_release_details.OrganizationReleaseDetailsEndpoint,
    sentry.api.endpoints.organization_release_file_details.OrganizationReleaseFileDetailsEndpoint,
    sentry.api.endpoints.organization_release_files.OrganizationReleaseFilesEndpoint,
    sentry.api.endpoints.organization_releases.OrganizationReleasesEndpoint,
    sentry.api.endpoints.organization_repositories.OrganizationRepositoriesEndpoint,
    sentry.api.endpoints.organization_repository_commits.OrganizationRepositoryCommitsEndpoint,
    sentry.api.endpoints.organization_sessions.OrganizationSessionsEndpoint,
    sentry.api.endpoints.organization_shortid.ShortIdLookupEndpoint,
    sentry.api.endpoints.organization_stats.OrganizationStatsEndpoint,
    sentry.api.endpoints.organization_stats_v2.OrganizationStatsEndpointV2,
    sentry.api.endpoints.organization_teams.OrganizationTeamsEndpoint,
    sentry.api.endpoints.organization_users.OrganizationUsersEndpoint,
    sentry.api.endpoints.project_details.ProjectDetailsEndpoint,
    sentry.api.endpoints.project_event_details.ProjectEventDetailsEndpoint,
    sentry.api.endpoints.project_events.ProjectEventsEndpoint,
    sentry.api.endpoints.project_group_index.ProjectGroupIndexEndpoint,
    sentry.api.endpoints.project_index.ProjectIndexEndpoint,
    sentry.api.endpoints.project_issues_resolved_in_release.ProjectIssuesResolvedInReleaseEndpoint,
    sentry.api.endpoints.project_key_details.ProjectKeyDetailsEndpoint,
    sentry.api.endpoints.project_keys.ProjectKeysEndpoint,
    sentry.api.endpoints.project_release_commits.ProjectReleaseCommitsEndpoint,
    sentry.api.endpoints.project_release_file_details.ProjectReleaseFileDetailsEndpoint,
    sentry.api.endpoints.project_release_files.ProjectReleaseFilesEndpoint,
    sentry.api.endpoints.project_servicehook_details.ProjectServiceHookDetailsEndpoint,
    sentry.api.endpoints.project_servicehooks.ProjectServiceHooksEndpoint,
    sentry.api.endpoints.project_stats.ProjectStatsEndpoint,
    sentry.api.endpoints.project_tagkey_values.ProjectTagKeyValuesEndpoint,
    sentry.api.endpoints.project_team_details.ProjectTeamDetailsEndpoint,
    sentry.api.endpoints.project_user_reports.ProjectUserReportsEndpoint,
    sentry.api.endpoints.project_users.ProjectUsersEndpoint,
    sentry.api.endpoints.release_deploys.ReleaseDeploysEndpoint,
    sentry.api.endpoints.sentry_app_installation_external_issue_details.SentryAppInstallationExternalIssueDetailsEndpoint,
    sentry.api.endpoints.sentry_app_installation_external_issues.SentryAppInstallationExternalIssuesEndpoint,
    sentry.api.endpoints.sentry_app_installations.SentryAppInstallationsEndpoint,
    sentry.api.endpoints.shared_group_details.SharedGroupDetailsEndpoint,
    sentry.api.endpoints.team_details.TeamDetailsEndpoint,
    sentry.api.endpoints.team_projects.TeamProjectsEndpoint,
    sentry.api.endpoints.team_stats.TeamStatsEndpoint,
    sentry.scim.endpoints.members.OrganizationSCIMMemberIndex,
    sentry.scim.endpoints.teams.OrganizationSCIMTeamDetails,
    sentry.scim.endpoints.teams.OrganizationSCIMTeamIndex,
}

__EXCLUDED_FROM_PUBLIC_ENDPOINTS = {
    sentry.api.endpoints.accept_organization_invite.AcceptOrganizationInvite,
    sentry.api.endpoints.accept_project_transfer.AcceptProjectTransferEndpoint,
    sentry.api.endpoints.api_application_details.ApiApplicationDetailsEndpoint,
    sentry.api.endpoints.api_applications.ApiApplicationsEndpoint,
    sentry.api.endpoints.api_authorizations.ApiAuthorizationsEndpoint,
    sentry.api.endpoints.api_tokens.ApiTokensEndpoint,
    sentry.api.endpoints.assistant.AssistantEndpoint,
    sentry.api.endpoints.auth_config.AuthConfigEndpoint,
    sentry.api.endpoints.auth_index.AuthIndexEndpoint,
    sentry.api.endpoints.auth_login.AuthLoginEndpoint,
    sentry.api.endpoints.authenticator_index.AuthenticatorIndexEndpoint,
    sentry.api.endpoints.broadcast_details.BroadcastDetailsEndpoint,
    sentry.api.endpoints.broadcast_index.BroadcastIndexEndpoint,
    sentry.api.endpoints.builtin_symbol_sources.BuiltinSymbolSourcesEndpoint,
    sentry.api.endpoints.chunk.ChunkUploadEndpoint,
    sentry.api.endpoints.data_scrubbing_selector_suggestions.DataScrubbingSelectorSuggestionsEndpoint,
    sentry.api.endpoints.debug_files.AssociateDSymFilesEndpoint,
    sentry.api.endpoints.debug_files.DifAssembleEndpoint,
    sentry.api.endpoints.debug_files.SourceMapsEndpoint,
    sentry.api.endpoints.doc_integration_avatar.DocIntegrationAvatarEndpoint,
    sentry.api.endpoints.doc_integration_details.DocIntegrationDetailsEndpoint,
    sentry.api.endpoints.doc_integrations.DocIntegrationsEndpoint,
    sentry.api.endpoints.event_apple_crash_report.EventAppleCrashReportEndpoint,
    sentry.api.endpoints.event_attachment_details.EventAttachmentDetailsEndpoint,
    sentry.api.endpoints.event_attachments.EventAttachmentsEndpoint,
    sentry.api.endpoints.event_file_committers.EventFileCommittersEndpoint,
    sentry.api.endpoints.event_grouping_info.EventGroupingInfoEndpoint,
    sentry.api.endpoints.event_owners.EventOwnersEndpoint,
    sentry.api.endpoints.event_reprocessable.EventReprocessableEndpoint,
    sentry.api.endpoints.external_team.ExternalTeamEndpoint,
    sentry.api.endpoints.external_user.ExternalUserEndpoint,
    sentry.api.endpoints.external_user_details.ExternalUserDetailsEndpoint,
    sentry.api.endpoints.group_activities.GroupActivitiesEndpoint,
    sentry.api.endpoints.group_attachments.GroupAttachmentsEndpoint,
    sentry.api.endpoints.group_current_release.GroupCurrentReleaseEndpoint,
    sentry.api.endpoints.group_external_issue_details.GroupExternalIssueDetailsEndpoint,
    sentry.api.endpoints.group_external_issues.GroupExternalIssuesEndpoint,
    sentry.api.endpoints.group_first_last_release.GroupFirstLastReleaseEndpoint,
    sentry.api.endpoints.group_hashes_split.GroupHashesSplitEndpoint,
    sentry.api.endpoints.group_integration_details.GroupIntegrationDetailsEndpoint,
    sentry.api.endpoints.group_integrations.GroupIntegrationsEndpoint,
    sentry.api.endpoints.group_notes.GroupNotesEndpoint,
    sentry.api.endpoints.group_notes_details.GroupNotesDetailsEndpoint,
    sentry.api.endpoints.group_participants.GroupParticipantsEndpoint,
    sentry.api.endpoints.group_reprocessing.GroupReprocessingEndpoint,
    sentry.api.endpoints.group_similar_issues.GroupSimilarIssuesEndpoint,
    sentry.api.endpoints.group_stats.GroupStatsEndpoint,
    sentry.api.endpoints.group_tags.GroupTagsEndpoint,
    sentry.api.endpoints.group_tombstone.GroupTombstoneEndpoint,
    sentry.api.endpoints.group_tombstone_details.GroupTombstoneDetailsEndpoint,
    sentry.api.endpoints.group_user_reports.GroupUserReportsEndpoint,
    sentry.api.endpoints.grouping_configs.GroupingConfigsEndpoint,
    sentry.api.endpoints.grouping_level_new_issues.GroupingLevelNewIssuesEndpoint,
    sentry.api.endpoints.grouping_levels.GroupingLevelsEndpoint,
    sentry.api.endpoints.index.IndexEndpoint,
    sentry.api.endpoints.integration_features.IntegrationFeaturesEndpoint,
    sentry.api.endpoints.internal_beacon.InternalBeaconEndpoint,
    sentry.api.endpoints.internal_environment.InternalEnvironmentEndpoint,
    sentry.api.endpoints.internal_mail.InternalMailEndpoint,
    sentry.api.endpoints.internal_packages.InternalPackagesEndpoint,
    sentry.api.endpoints.internal_queue_tasks.InternalQueueTasksEndpoint,
    sentry.api.endpoints.internal_quotas.InternalQuotasEndpoint,
    sentry.api.endpoints.internal_stats.InternalStatsEndpoint,
    sentry.api.endpoints.internal_warnings.InternalWarningsEndpoint,
    sentry.api.endpoints.monitor_checkin_details.MonitorCheckInDetailsEndpoint,
    sentry.api.endpoints.monitor_checkins.MonitorCheckInsEndpoint,
    sentry.api.endpoints.monitor_details.MonitorDetailsEndpoint,
    sentry.api.endpoints.monitor_stats.MonitorStatsEndpoint,
    sentry.api.endpoints.organization_access_request_details.OrganizationAccessRequestDetailsEndpoint,
    sentry.api.endpoints.organization_activity.OrganizationActivityEndpoint,
    sentry.api.endpoints.organization_api_key_details.OrganizationApiKeyDetailsEndpoint,
    sentry.api.endpoints.organization_api_key_index.OrganizationApiKeyIndexEndpoint,
    sentry.api.endpoints.organization_auditlogs.OrganizationAuditLogsEndpoint,
    sentry.api.endpoints.organization_auth_provider_details.OrganizationAuthProviderDetailsEndpoint,
    sentry.api.endpoints.organization_auth_provider_send_reminders.OrganizationAuthProviderSendRemindersEndpoint,
    sentry.api.endpoints.organization_auth_providers.OrganizationAuthProvidersEndpoint,
    sentry.api.endpoints.organization_avatar.OrganizationAvatarEndpoint,
    sentry.api.endpoints.organization_code_mapping_codeowners.OrganizationCodeMappingCodeOwnersEndpoint,
    sentry.api.endpoints.organization_code_mapping_details.OrganizationCodeMappingDetailsEndpoint,
    sentry.api.endpoints.organization_code_mappings.OrganizationCodeMappingsEndpoint,
    sentry.api.endpoints.organization_codeowners_associations.OrganizationCodeOwnersAssociationsEndpoint,
    sentry.api.endpoints.organization_config_integrations.OrganizationConfigIntegrationsEndpoint,
    sentry.api.endpoints.organization_config_repositories.OrganizationConfigRepositoriesEndpoint,
    sentry.api.endpoints.organization_dashboard_details.OrganizationDashboardDetailsEndpoint,
    sentry.api.endpoints.organization_dashboard_details.OrganizationDashboardVisitEndpoint,
    sentry.api.endpoints.organization_dashboard_widget_details.OrganizationDashboardWidgetDetailsEndpoint,
    sentry.api.endpoints.organization_dashboards.OrganizationDashboardsEndpoint,
    sentry.api.endpoints.organization_environments.OrganizationEnvironmentsEndpoint,
    sentry.api.endpoints.organization_event_details.OrganizationEventDetailsEndpoint,
    sentry.api.endpoints.organization_events.OrganizationEventsGeoEndpoint,
    sentry.api.endpoints.organization_events.OrganizationEventsV2Endpoint,
    sentry.api.endpoints.organization_events_facets.OrganizationEventsFacetsEndpoint,
    sentry.api.endpoints.organization_events_facets_performance.OrganizationEventsFacetsPerformanceEndpoint,
    sentry.api.endpoints.organization_events_facets_performance.OrganizationEventsFacetsPerformanceHistogramEndpoint,
    sentry.api.endpoints.organization_events_has_measurements.OrganizationEventsHasMeasurementsEndpoint,
    sentry.api.endpoints.organization_events_histogram.OrganizationEventsHistogramEndpoint,
    sentry.api.endpoints.organization_events_meta.OrganizationEventsMetaEndpoint,
    sentry.api.endpoints.organization_events_meta.OrganizationEventsRelatedIssuesEndpoint,
    sentry.api.endpoints.organization_events_span_ops.OrganizationEventsSpanOpsEndpoint,
    sentry.api.endpoints.organization_events_spans_performance.OrganizationEventsSpansExamplesEndpoint,
    sentry.api.endpoints.organization_events_spans_performance.OrganizationEventsSpansPerformanceEndpoint,
    sentry.api.endpoints.organization_events_spans_performance.OrganizationEventsSpansStatsEndpoint,
    sentry.api.endpoints.organization_events_stats.OrganizationEventsStatsEndpoint,
    sentry.api.endpoints.organization_events_trace.OrganizationEventsTraceEndpoint,
    sentry.api.endpoints.organization_events_trace.OrganizationEventsTraceLightEndpoint,
    sentry.api.endpoints.organization_events_trace.OrganizationEventsTraceMetaEndpoint,
    sentry.api.endpoints.organization_events_trends.OrganizationEventsTrendsEndpoint,
    sentry.api.endpoints.organization_events_trends.OrganizationEventsTrendsStatsEndpoint,
    sentry.api.endpoints.organization_events_vitals.OrganizationEventsVitalsEndpoint,
    sentry.api.endpoints.organization_group_index.OrganizationGroupIndexEndpoint,
    sentry.api.endpoints.organization_group_index_stats.OrganizationGroupIndexStatsEndpoint,
    sentry.api.endpoints.organization_has_mobile_app_events.OrganizationHasMobileAppEvents,
    sentry.api.endpoints.organization_integration_details.OrganizationIntegrationDetailsEndpoint,
    sentry.api.endpoints.organization_integration_repos.OrganizationIntegrationReposEndpoint,
    sentry.api.endpoints.organization_integration_request.OrganizationIntegrationRequestEndpoint,
    sentry.api.endpoints.organization_integration_serverless_functions.OrganizationIntegrationServerlessFunctionsEndpoint,
    sentry.api.endpoints.organization_integrations.OrganizationIntegrationsEndpoint,
    sentry.api.endpoints.organization_invite_request_details.OrganizationInviteRequestDetailsEndpoint,
    sentry.api.endpoints.organization_invite_request_index.OrganizationInviteRequestIndexEndpoint,
    sentry.api.endpoints.organization_issues_count.OrganizationIssuesCountEndpoint,
    sentry.api.endpoints.organization_issues_resolved_in_release.OrganizationIssuesResolvedInReleaseEndpoint,
    sentry.api.endpoints.organization_join_request.OrganizationJoinRequestEndpoint,
    sentry.api.endpoints.organization_member_details.OrganizationMemberDetailsEndpoint,
    sentry.api.endpoints.organization_member_index.OrganizationMemberIndexEndpoint,
    sentry.api.endpoints.organization_member_issues_assigned.OrganizationMemberIssuesAssignedEndpoint,
    sentry.api.endpoints.organization_member_issues_bookmarked.OrganizationMemberIssuesBookmarkedEndpoint,
    sentry.api.endpoints.organization_member_issues_viewed.OrganizationMemberIssuesViewedEndpoint,
    sentry.api.endpoints.organization_member_unreleased_commits.OrganizationMemberUnreleasedCommitsEndpoint,
    sentry.api.endpoints.organization_metrics.OrganizationMetricDetailsEndpoint,
    sentry.api.endpoints.organization_metrics.OrganizationMetricsDataEndpoint,
    sentry.api.endpoints.organization_metrics.OrganizationMetricsEndpoint,
    sentry.api.endpoints.organization_metrics.OrganizationMetricsTagDetailsEndpoint,
    sentry.api.endpoints.organization_metrics.OrganizationMetricsTagsEndpoint,
    sentry.api.endpoints.organization_monitors.OrganizationMonitorsEndpoint,
    sentry.api.endpoints.organization_onboarding_tasks.OrganizationOnboardingTaskEndpoint,
    sentry.api.endpoints.organization_pinned_searches.OrganizationPinnedSearchEndpoint,
    sentry.api.endpoints.organization_plugins.OrganizationPluginsEndpoint,
    sentry.api.endpoints.organization_plugins_configs.OrganizationPluginsConfigsEndpoint,
    sentry.api.endpoints.organization_processingissues.OrganizationProcessingIssuesEndpoint,
    sentry.api.endpoints.organization_projects.OrganizationProjectsCountEndpoint,
    sentry.api.endpoints.organization_projects_sent_first_event.OrganizationProjectsSentFirstEventEndpoint,
    sentry.api.endpoints.organization_recent_searches.OrganizationRecentSearchesEndpoint,
    sentry.api.endpoints.organization_relay_usage.OrganizationRelayUsage,
    sentry.api.endpoints.organization_release_assemble.OrganizationReleaseAssembleEndpoint,
    sentry.api.endpoints.organization_release_meta.OrganizationReleaseMetaEndpoint,
    sentry.api.endpoints.organization_release_previous_commits.OrganizationReleasePreviousCommitsEndpoint,
    sentry.api.endpoints.organization_releases.OrganizationReleasesStatsEndpoint,
    sentry.api.endpoints.organization_repository_details.OrganizationRepositoryDetailsEndpoint,
    sentry.api.endpoints.organization_request_project_creation.OrganizationRequestProjectCreation,
    sentry.api.endpoints.organization_sdk_updates.OrganizationSdkUpdatesEndpoint,
    sentry.api.endpoints.organization_search_details.OrganizationSearchDetailsEndpoint,
    sentry.api.endpoints.organization_searches.OrganizationSearchesEndpoint,
    sentry.api.endpoints.organization_sentry_apps.OrganizationSentryAppsEndpoint,
    sentry.api.endpoints.organization_slugs.SlugsUpdateEndpoint,
    sentry.api.endpoints.organization_tagkey_values.OrganizationTagKeyValuesEndpoint,
    sentry.api.endpoints.organization_tags.OrganizationTagsEndpoint,
    sentry.api.endpoints.organization_user_details.OrganizationUserDetailsEndpoint,
    sentry.api.endpoints.organization_user_issues.OrganizationUserIssuesEndpoint,
    sentry.api.endpoints.organization_user_issues_search.OrganizationUserIssuesSearchEndpoint,
    sentry.api.endpoints.organization_user_reports.OrganizationUserReportsEndpoint,
    sentry.api.endpoints.organization_user_teams.OrganizationUserTeamsEndpoint,
    sentry.api.endpoints.project_agnostic_rule_conditions.ProjectAgnosticRuleConditionsEndpoint,
    sentry.api.endpoints.project_app_store_connect_credentials.AppStoreConnectAppsEndpoint,
    sentry.api.endpoints.project_app_store_connect_credentials.AppStoreConnectCreateCredentialsEndpoint,
    sentry.api.endpoints.project_app_store_connect_credentials.AppStoreConnectStatusEndpoint,
    sentry.api.endpoints.project_app_store_connect_credentials.AppStoreConnectUpdateCredentialsEndpoint,
    sentry.api.endpoints.project_avatar.ProjectAvatarEndpoint,
    sentry.api.endpoints.project_codeowners.ProjectCodeOwnersEndpoint,
    sentry.api.endpoints.project_codeowners_details.ProjectCodeOwnersDetailsEndpoint,
    sentry.api.endpoints.project_codeowners_request.ProjectCodeOwnersRequestEndpoint,
    sentry.api.endpoints.project_create_sample.ProjectCreateSampleEndpoint,
    sentry.api.endpoints.project_create_sample_transaction.ProjectCreateSampleTransactionEndpoint,
    sentry.api.endpoints.project_docs_platform.ProjectDocsPlatformEndpoint,
    sentry.api.endpoints.project_environment_details.ProjectEnvironmentDetailsEndpoint,
    sentry.api.endpoints.project_environments.ProjectEnvironmentsEndpoint,
    sentry.api.endpoints.project_event_details.EventJsonEndpoint,
    sentry.api.endpoints.project_filter_details.ProjectFilterDetailsEndpoint,
    sentry.api.endpoints.project_filters.ProjectFiltersEndpoint,
    sentry.api.endpoints.project_group_stats.ProjectGroupStatsEndpoint,
    sentry.api.endpoints.project_grouping_configs.ProjectGroupingConfigsEndpoint,
    sentry.api.endpoints.project_key_stats.ProjectKeyStatsEndpoint,
    sentry.api.endpoints.project_member_index.ProjectMemberIndexEndpoint,
    sentry.api.endpoints.project_ownership.ProjectOwnershipEndpoint,
    sentry.api.endpoints.project_platforms.ProjectPlatformsEndpoint,
    sentry.api.endpoints.project_plugin_details.ProjectPluginDetailsEndpoint,
    sentry.api.endpoints.project_plugins.ProjectPluginsEndpoint,
    sentry.api.endpoints.project_processingissues.ProjectProcessingIssuesDiscardEndpoint,
    sentry.api.endpoints.project_processingissues.ProjectProcessingIssuesEndpoint,
    sentry.api.endpoints.project_processingissues.ProjectProcessingIssuesFixEndpoint,
    sentry.api.endpoints.project_release_details.ProjectReleaseDetailsEndpoint,
    sentry.api.endpoints.project_release_repositories.ProjectReleaseRepositories,
    sentry.api.endpoints.project_release_setup.ProjectReleaseSetupCompletionEndpoint,
    sentry.api.endpoints.project_release_stats.ProjectReleaseStatsEndpoint,
    sentry.api.endpoints.project_releases.ProjectReleasesEndpoint,
    sentry.api.endpoints.project_releases_token.ProjectReleasesTokenEndpoint,
    sentry.api.endpoints.project_repo_path_parsing.ProjectRepoPathParsingEndpoint,
    sentry.api.endpoints.project_reprocessing.ProjectReprocessingEndpoint,
    sentry.api.endpoints.project_rule_details.ProjectRuleDetailsEndpoint,
    sentry.api.endpoints.project_rule_task_details.ProjectRuleTaskDetailsEndpoint,
    sentry.api.endpoints.project_rules.ProjectRulesEndpoint,
    sentry.api.endpoints.project_rules_configuration.ProjectRulesConfigurationEndpoint,
    sentry.api.endpoints.project_search_details.ProjectSearchDetailsEndpoint,
    sentry.api.endpoints.project_searches.ProjectSearchesEndpoint,
    sentry.api.endpoints.project_servicehook_stats.ProjectServiceHookStatsEndpoint,
    sentry.api.endpoints.project_stacktrace_link.ProjectStacktraceLinkEndpoint,
    sentry.api.endpoints.project_tagkey_details.ProjectTagKeyDetailsEndpoint,
    sentry.api.endpoints.project_tags.ProjectTagsEndpoint,
    sentry.api.endpoints.project_teams.ProjectTeamsEndpoint,
    sentry.api.endpoints.project_transaction_threshold.ProjectTransactionThresholdEndpoint,
    sentry.api.endpoints.project_transaction_threshold_override.ProjectTransactionThresholdOverrideEndpoint,
    sentry.api.endpoints.project_transfer.ProjectTransferEndpoint,
    sentry.api.endpoints.project_user_details.ProjectUserDetailsEndpoint,
    sentry.api.endpoints.project_user_stats.ProjectUserStatsEndpoint,
    sentry.api.endpoints.prompts_activity.PromptsActivityEndpoint,
    sentry.api.endpoints.relay_details.RelayDetailsEndpoint,
    sentry.api.endpoints.relay_healthcheck.RelayHealthCheck,
    sentry.api.endpoints.relay_index.RelayIndexEndpoint,
    sentry.api.endpoints.relay_projectconfigs.RelayProjectConfigsEndpoint,
    sentry.api.endpoints.relay_projectids.RelayProjectIdsEndpoint,
    sentry.api.endpoints.relay_publickeys.RelayPublicKeysEndpoint,
    sentry.api.endpoints.relay_register.RelayRegisterChallengeEndpoint,
    sentry.api.endpoints.relay_register.RelayRegisterResponseEndpoint,
    sentry.api.endpoints.sentry_app_authorizations.SentryAppAuthorizationsEndpoint,
    sentry.api.endpoints.sentry_app_avatar.SentryAppAvatarEndpoint,
    sentry.api.endpoints.sentry_app_components.OrganizationSentryAppComponentsEndpoint,
    sentry.api.endpoints.sentry_app_components.SentryAppComponentsEndpoint,
    sentry.api.endpoints.sentry_app_details.SentryAppDetailsEndpoint,
    sentry.api.endpoints.sentry_app_features.SentryAppFeaturesEndpoint,
    sentry.api.endpoints.sentry_app_installation_details.SentryAppInstallationDetailsEndpoint,
    sentry.api.endpoints.sentry_app_installation_external_issue_actions.SentryAppInstallationExternalIssueActionsEndpoint,
    sentry.api.endpoints.sentry_app_installation_external_requests.SentryAppInstallationExternalRequestsEndpoint,
    sentry.api.endpoints.sentry_app_interaction.SentryAppInteractionEndpoint,
    sentry.api.endpoints.sentry_app_publish_request.SentryAppPublishRequestEndpoint,
    sentry.api.endpoints.sentry_app_requests.SentryAppRequestsEndpoint,
    sentry.api.endpoints.sentry_app_stats.SentryAppStatsEndpoint,
    sentry.api.endpoints.sentry_apps.SentryAppsEndpoint,
    sentry.api.endpoints.sentry_apps_stats.SentryAppsStatsEndpoint,
    sentry.api.endpoints.sentry_internal_app_token_details.SentryInternalAppTokenDetailsEndpoint,
    sentry.api.endpoints.sentry_internal_app_tokens.SentryInternalAppTokensEndpoint,
    sentry.api.endpoints.setup_wizard.SetupWizard,
    sentry.api.endpoints.system_health.SystemHealthEndpoint,
    sentry.api.endpoints.system_options.SystemOptionsEndpoint,
    sentry.api.endpoints.team_alerts_triggered.TeamAlertsTriggeredIndexEndpoint,
    sentry.api.endpoints.team_alerts_triggered.TeamAlertsTriggeredTotalsEndpoint,
    sentry.api.endpoints.team_all_unresolved_issues.TeamAllUnresolvedIssuesEndpoint,
    sentry.api.endpoints.team_avatar.TeamAvatarEndpoint,
    sentry.api.endpoints.team_groups_old.TeamGroupsOldEndpoint,
    sentry.api.endpoints.team_issue_breakdown.TeamIssueBreakdownEndpoint,
    sentry.api.endpoints.team_members.TeamMembersEndpoint,
    sentry.api.endpoints.team_notification_settings_details.TeamNotificationSettingsDetailsEndpoint,
    sentry.api.endpoints.team_release_count.TeamReleaseCountEndpoint,
    sentry.api.endpoints.team_time_to_resolution.TeamTimeToResolutionEndpoint,
    sentry.api.endpoints.team_unresolved_issue_age.TeamUnresolvedIssueAgeEndpoint,
    sentry.api.endpoints.user_authenticator_details.UserAuthenticatorDetailsEndpoint,
    sentry.api.endpoints.user_authenticator_enroll.UserAuthenticatorEnrollEndpoint,
    sentry.api.endpoints.user_authenticator_index.UserAuthenticatorIndexEndpoint,
    sentry.api.endpoints.user_details.UserDetailsEndpoint,
    sentry.api.endpoints.user_emails.UserEmailsEndpoint,
    sentry.api.endpoints.user_emails_confirm.UserEmailsConfirmEndpoint,
    sentry.api.endpoints.user_identity.UserIdentityEndpoint,
    sentry.api.endpoints.user_identity_config.UserIdentityConfigDetailsEndpoint,
    sentry.api.endpoints.user_identity_config.UserIdentityConfigEndpoint,
    sentry.api.endpoints.user_identity_details.UserIdentityDetailsEndpoint,
    sentry.api.endpoints.user_index.UserIndexEndpoint,
    sentry.api.endpoints.user_ips.UserIPsEndpoint,
    sentry.api.endpoints.user_notification_details.UserNotificationDetailsEndpoint,
    sentry.api.endpoints.user_notification_fine_tuning.UserNotificationFineTuningEndpoint,
    sentry.api.endpoints.user_notification_settings_details.UserNotificationSettingsDetailsEndpoint,
    sentry.api.endpoints.user_organizationintegrations.UserOrganizationIntegrationsEndpoint,
    sentry.api.endpoints.user_organizations.UserOrganizationsEndpoint,
    sentry.api.endpoints.user_password.UserPasswordEndpoint,
    sentry.api.endpoints.user_permission_details.UserPermissionDetailsEndpoint,
    sentry.api.endpoints.user_permissions.UserPermissionsEndpoint,
    sentry.api.endpoints.user_permissions_config.UserPermissionsConfigEndpoint,
    sentry.api.endpoints.user_role_details.UserUserRoleDetailsEndpoint,
    sentry.api.endpoints.user_roles.UserUserRolesEndpoint,
    sentry.api.endpoints.user_social_identities_index.UserSocialIdentitiesIndexEndpoint,
    sentry.api.endpoints.user_social_identity_details.UserSocialIdentityDetailsEndpoint,
    sentry.api.endpoints.user_subscriptions.UserSubscriptionsEndpoint,
    sentry.api.endpoints.useravatar.UserAvatarEndpoint,
    sentry.api.endpoints.userroles_details.UserRoleDetailsEndpoint,
    sentry.api.endpoints.userroles_index.UserRolesEndpoint,
    sentry.data_export.endpoints.data_export.DataExportEndpoint,
    sentry.data_export.endpoints.data_export_details.DataExportDetailsEndpoint,
    sentry.discover.endpoints.discover_key_transactions.KeyTransactionEndpoint,
    sentry.discover.endpoints.discover_key_transactions.KeyTransactionListEndpoint,
    sentry.discover.endpoints.discover_query.DiscoverQueryEndpoint,
    sentry.discover.endpoints.discover_saved_queries.DiscoverSavedQueriesEndpoint,
    sentry.discover.endpoints.discover_saved_query_detail.DiscoverSavedQueryDetailEndpoint,
    sentry.discover.endpoints.discover_saved_query_detail.DiscoverSavedQueryVisitEndpoint,
    sentry.incidents.endpoints.organization_alert_rule_available_action_index.OrganizationAlertRuleAvailableActionIndexEndpoint,
    sentry.incidents.endpoints.organization_alert_rule_details.OrganizationAlertRuleDetailsEndpoint,
    sentry.incidents.endpoints.organization_alert_rule_index.OrganizationAlertRuleIndexEndpoint,
    sentry.incidents.endpoints.organization_alert_rule_index.OrganizationCombinedRuleIndexEndpoint,
    sentry.incidents.endpoints.organization_incident_activity_index.OrganizationIncidentActivityIndexEndpoint,
    sentry.incidents.endpoints.organization_incident_comment_details.OrganizationIncidentCommentDetailsEndpoint,
    sentry.incidents.endpoints.organization_incident_comment_index.OrganizationIncidentCommentIndexEndpoint,
    sentry.incidents.endpoints.organization_incident_details.OrganizationIncidentDetailsEndpoint,
    sentry.incidents.endpoints.organization_incident_index.OrganizationIncidentIndexEndpoint,
    sentry.incidents.endpoints.organization_incident_seen.OrganizationIncidentSeenEndpoint,
    sentry.incidents.endpoints.organization_incident_subscription_index.OrganizationIncidentSubscriptionIndexEndpoint,
    sentry.incidents.endpoints.project_alert_rule_details.ProjectAlertRuleDetailsEndpoint,
    sentry.incidents.endpoints.project_alert_rule_index.ProjectAlertRuleIndexEndpoint,
    sentry.incidents.endpoints.project_alert_rule_index.ProjectCombinedRuleIndexEndpoint,
    sentry.incidents.endpoints.project_alert_rule_task_details.ProjectAlertRuleTaskDetailsEndpoint,
    sentry.integrations.bitbucket.descriptor.BitbucketDescriptorEndpoint,
    sentry.integrations.bitbucket.installed.BitbucketInstalledEndpoint,
    sentry.integrations.bitbucket.search.BitbucketSearchEndpoint,
    sentry.integrations.bitbucket.uninstalled.BitbucketUninstalledEndpoint,
    sentry.integrations.cloudflare.metadata.CloudflareMetadataEndpoint,
    sentry.integrations.cloudflare.webhook.CloudflareWebhookEndpoint,
    sentry.integrations.github.search.GitHubSearchEndpoint,
    sentry.integrations.gitlab.search.GitlabIssueSearchEndpoint,
    sentry.integrations.jira.descriptor.JiraDescriptorEndpoint,
    sentry.integrations.jira.installed.JiraInstalledEndpoint,
    sentry.integrations.jira.search.JiraSearchEndpoint,
    sentry.integrations.jira.uninstalled.JiraUninstalledEndpoint,
    sentry.integrations.jira.webhooks.JiraIssueUpdatedWebhook,
    sentry.integrations.jira_server.search.JiraServerSearchEndpoint,
    sentry.integrations.jira_server.webhooks.JiraIssueUpdatedWebhook,
    sentry.integrations.msteams.webhook.MsTeamsWebhookEndpoint,
    sentry.integrations.slack.endpoints.action.SlackActionEndpoint,
    sentry.integrations.slack.endpoints.command.SlackCommandsEndpoint,
    sentry.integrations.slack.endpoints.event.SlackEventEndpoint,
    sentry.integrations.vercel.generic_webhook.VercelGenericWebhookEndpoint,
    sentry.integrations.vercel.webhook.VercelWebhookEndpoint,
    sentry.integrations.vsts.search.VstsSearchEndpoint,
    sentry.integrations.vsts.webhooks.WorkItemWebhook,
    sentry.plugins.bases.issue2.IssueGroupActionEndpoint,
    sentry.plugins.endpoints.PluginGroupEndpoint,
    sentry.scim.endpoints.schemas.OrganizationSCIMSchemaIndex,
}


PUBLIC_ENDPOINTS_FROM_JSON = {f"{v.__module__}.{v.__name__}" for v in __PUBLIC_ENDPOINTS_FROM_JSON}
EXCLUDED_FROM_PUBLIC_ENDPOINTS = {
    f"{v.__module__}.{v.__name__}" for v in __EXCLUDED_FROM_PUBLIC_ENDPOINTS
}
