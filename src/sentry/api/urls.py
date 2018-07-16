from __future__ import absolute_import, print_function

from django.conf.urls import include, patterns, url

from .endpoints.accept_project_transfer import AcceptProjectTransferEndpoint
from .endpoints.relay_heartbeat import RelayHeartbeatEndpoint
from .endpoints.relay_projectconfigs import RelayProjectConfigsEndpoint
from .endpoints.relay_publickeys import RelayPublicKeysEndpoint
from .endpoints.relay_index import RelayIndexEndpoint
from .endpoints.relay_details import RelayDetailsEndpoint
from .endpoints.relay_register import RelayRegisterChallengeEndpoint, \
    RelayRegisterResponseEndpoint
from .endpoints.api_applications import ApiApplicationsEndpoint
from .endpoints.api_application_details import ApiApplicationDetailsEndpoint
from .endpoints.api_authorizations import ApiAuthorizationsEndpoint
from .endpoints.api_tokens import ApiTokensEndpoint
from .endpoints.assistant import AssistantEndpoint
from .endpoints.auth_index import AuthIndexEndpoint
from .endpoints.authenticator_index import AuthenticatorIndexEndpoint
from .endpoints.broadcast_details import BroadcastDetailsEndpoint
from .endpoints.broadcast_index import BroadcastIndexEndpoint
from .endpoints.catchall import CatchallEndpoint
from .endpoints.chunk import ChunkUploadEndpoint
from .endpoints.event_attachment_details import EventAttachmentDetailsEndpoint
from .endpoints.event_attachments import EventAttachmentsEndpoint
from .endpoints.event_details import EventDetailsEndpoint
from .endpoints.event_owners import EventOwnersEndpoint
from .endpoints.event_apple_crash_report import EventAppleCrashReportEndpoint
from .endpoints.group_details import GroupDetailsEndpoint
from .endpoints.group_events import GroupEventsEndpoint
from .endpoints.group_events_latest import GroupEventsLatestEndpoint
from .endpoints.group_events_oldest import GroupEventsOldestEndpoint
from .endpoints.group_hashes import GroupHashesEndpoint
from .endpoints.group_integration_details import GroupIntegrationDetailsEndpoint
from .endpoints.group_integrations import GroupIntegrationsEndpoint
from .endpoints.group_notes import GroupNotesEndpoint
from .endpoints.group_notes_details import GroupNotesDetailsEndpoint
from .endpoints.group_participants import GroupParticipantsEndpoint
from .endpoints.group_similar_issues import GroupSimilarIssuesEndpoint
from .endpoints.group_stats import GroupStatsEndpoint
from .endpoints.group_tags import GroupTagsEndpoint
from .endpoints.group_tagkey_details import GroupTagKeyDetailsEndpoint
from .endpoints.group_tagkey_values import GroupTagKeyValuesEndpoint
from .endpoints.group_tombstone_details import GroupTombstoneDetailsEndpoint
from .endpoints.group_tombstone import GroupTombstoneEndpoint
from .endpoints.group_user_reports import GroupUserReportsEndpoint
from .endpoints.index import IndexEndpoint
from .endpoints.internal_queue_tasks import InternalQueueTasksEndpoint
from .endpoints.internal_quotas import InternalQuotasEndpoint
from .endpoints.internal_stats import InternalStatsEndpoint
from .endpoints.organization_access_request_details import OrganizationAccessRequestDetailsEndpoint
from .endpoints.organization_activity import OrganizationActivityEndpoint
from .endpoints.organization_auditlogs import OrganizationAuditLogsEndpoint
from .endpoints.organization_api_key_index import OrganizationApiKeyIndexEndpoint
from .endpoints.organization_api_key_details import OrganizationApiKeyDetailsEndpoint
from .endpoints.organization_auth_providers import OrganizationAuthProvidersEndpoint
from .endpoints.organization_auth_provider_details import OrganizationAuthProviderDetailsEndpoint
from .endpoints.organization_auth_provider_send_reminders import OrganizationAuthProviderSendRemindersEndpoint
from .endpoints.organization_avatar import OrganizationAvatarEndpoint
from .endpoints.organization_details import OrganizationDetailsEndpoint
from .endpoints.organization_discover import OrganizationDiscoverEndpoint
from .endpoints.organization_health import OrganizationHealthTopEndpoint
from .endpoints.organization_shortid import ShortIdLookupEndpoint
from .endpoints.organization_environments import OrganizationEnvironmentsEndpoint
from .endpoints.organization_eventid import EventIdLookupEndpoint
from .endpoints.organization_slugs import SlugsUpdateEndpoint
from .endpoints.organization_issues_new import OrganizationIssuesNewEndpoint
from .endpoints.organization_member_details import OrganizationMemberDetailsEndpoint
from .endpoints.organization_member_index import OrganizationMemberIndexEndpoint
from .endpoints.organization_member_issues_assigned import OrganizationMemberIssuesAssignedEndpoint
from .endpoints.organization_member_issues_bookmarked import OrganizationMemberIssuesBookmarkedEndpoint
from .endpoints.organization_member_issues_viewed import OrganizationMemberIssuesViewedEndpoint
from .endpoints.organization_member_unreleased_commits import OrganizationMemberUnreleasedCommitsEndpoint
from .endpoints.organization_member_team_details import OrganizationMemberTeamDetailsEndpoint
from .endpoints.organization_onboarding_tasks import OrganizationOnboardingTaskEndpoint
from .endpoints.organization_index import OrganizationIndexEndpoint
from .endpoints.organization_projects import OrganizationProjectsEndpoint
from .endpoints.organization_plugins import OrganizationPluginsEndpoint
from .endpoints.organization_releases import OrganizationReleasesEndpoint
from .endpoints.organization_release_details import OrganizationReleaseDetailsEndpoint
from .endpoints.organization_release_files import OrganizationReleaseFilesEndpoint
from .endpoints.organization_release_file_details import OrganizationReleaseFileDetailsEndpoint
from .endpoints.organization_release_commits import OrganizationReleaseCommitsEndpoint
from .endpoints.organization_repositories import OrganizationRepositoriesEndpoint
from .endpoints.organization_integration_details import OrganizationIntegrationDetailsEndpoint
from .endpoints.organization_integration_repos import OrganizationIntegrationReposEndpoint
from .endpoints.organization_integrations import OrganizationIntegrationsEndpoint
from .endpoints.organization_config_integrations import OrganizationConfigIntegrationsEndpoint
from .endpoints.organization_config_repositories import OrganizationConfigRepositoriesEndpoint
from .endpoints.organization_repository_commits import OrganizationRepositoryCommitsEndpoint
from .endpoints.organization_repository_details import OrganizationRepositoryDetailsEndpoint
from .endpoints.organization_stats import OrganizationStatsEndpoint
from .endpoints.organization_teams import OrganizationTeamsEndpoint
from .endpoints.organization_user_issues import OrganizationUserIssuesEndpoint
from .endpoints.organization_user_issues_search import OrganizationUserIssuesSearchEndpoint
from .endpoints.project_avatar import ProjectAvatarEndpoint
from .endpoints.project_details import ProjectDetailsEndpoint
from .endpoints.project_transfer import ProjectTransferEndpoint
from .endpoints.project_create_sample import ProjectCreateSampleEndpoint
from .endpoints.project_docs import ProjectDocsEndpoint
from .endpoints.project_docs_platform import ProjectDocsPlatformEndpoint
from .endpoints.project_environments import ProjectEnvironmentsEndpoint
from .endpoints.project_environment_details import ProjectEnvironmentDetailsEndpoint
from .endpoints.project_platforms import ProjectPlatformsEndpoint
from .endpoints.project_events import ProjectEventsEndpoint
from .endpoints.project_event_details import ProjectEventDetailsEndpoint
from .endpoints.project_filters import ProjectFiltersEndpoint
from .endpoints.project_filter_details import ProjectFilterDetailsEndpoint
from .endpoints.project_group_index import ProjectGroupIndexEndpoint
from .endpoints.project_group_stats import ProjectGroupStatsEndpoint
from .endpoints.project_index import ProjectIndexEndpoint
from .endpoints.project_keys import ProjectKeysEndpoint
from .endpoints.project_key_details import ProjectKeyDetailsEndpoint
from .endpoints.project_key_stats import ProjectKeyStatsEndpoint
from .endpoints.project_member_index import ProjectMemberIndexEndpoint
from .endpoints.project_ownership import ProjectOwnershipEndpoint
from .endpoints.project_plugins import ProjectPluginsEndpoint
from .endpoints.project_plugin_details import ProjectPluginDetailsEndpoint
from .endpoints.project_release_details import ProjectReleaseDetailsEndpoint
from .endpoints.project_release_files import ProjectReleaseFilesEndpoint
from .endpoints.project_release_file_details import ProjectReleaseFileDetailsEndpoint
from .endpoints.project_release_commits import ProjectReleaseCommitsEndpoint
from .endpoints.project_releases import ProjectReleasesEndpoint
from .endpoints.project_releases_token import ProjectReleasesTokenEndpoint
from .endpoints.project_rules import ProjectRulesEndpoint
from .endpoints.project_rules_configuration import ProjectRulesConfigurationEndpoint
from .endpoints.project_rule_details import ProjectRuleDetailsEndpoint
from .endpoints.project_searches import ProjectSearchesEndpoint
from .endpoints.project_search_details import ProjectSearchDetailsEndpoint
from .endpoints.project_stats import ProjectStatsEndpoint
from .endpoints.project_tags import ProjectTagsEndpoint
from .endpoints.project_tagkey_details import ProjectTagKeyDetailsEndpoint
from .endpoints.project_tagkey_values import ProjectTagKeyValuesEndpoint
from .endpoints.project_team_details import ProjectTeamDetailsEndpoint
from .endpoints.project_teams import ProjectTeamsEndpoint
from .endpoints.project_processingissues import ProjectProcessingIssuesEndpoint, \
    ProjectProcessingIssuesFixEndpoint, ProjectProcessingIssuesDiscardEndpoint
from .endpoints.project_reprocessing import ProjectReprocessingEndpoint
from .endpoints.project_servicehooks import ProjectServiceHooksEndpoint
from .endpoints.project_servicehook_details import ProjectServiceHookDetailsEndpoint
from .endpoints.project_servicehook_stats import ProjectServiceHookStatsEndpoint
from .endpoints.project_user_details import ProjectUserDetailsEndpoint
from .endpoints.project_user_reports import ProjectUserReportsEndpoint
from .endpoints.project_user_stats import ProjectUserStatsEndpoint
from .endpoints.project_users import ProjectUsersEndpoint
from .endpoints.filechange import CommitFileChangeEndpoint
from .endpoints.issues_resolved_in_release import IssuesResolvedInReleaseEndpoint
from .endpoints.release_deploys import ReleaseDeploysEndpoint
from .endpoints.dsym_files import DSymFilesEndpoint, \
    UnknownDSymFilesEndpoint, AssociateDSymFilesEndpoint
from .endpoints.dif_files import DifAssembleEndpoint
from .endpoints.shared_group_details import SharedGroupDetailsEndpoint
from .endpoints.system_health import SystemHealthEndpoint
from .endpoints.system_options import SystemOptionsEndpoint
from .endpoints.team_avatar import TeamAvatarEndpoint
from .endpoints.team_details import TeamDetailsEndpoint
from .endpoints.team_groups_new import TeamGroupsNewEndpoint
from .endpoints.team_groups_trending import TeamGroupsTrendingEndpoint
from .endpoints.team_members import TeamMembersEndpoint
from .endpoints.team_projects import TeamProjectsEndpoint
from .endpoints.team_stats import TeamStatsEndpoint
from .endpoints.useravatar import UserAvatarEndpoint
from .endpoints.user_appearance import UserAppearanceEndpoint
from .endpoints.user_authenticator_index import UserAuthenticatorIndexEndpoint
from .endpoints.user_authenticator_enroll import UserAuthenticatorEnrollEndpoint
from .endpoints.user_authenticator_details import UserAuthenticatorDetailsEndpoint
from .endpoints.user_identity_details import UserIdentityDetailsEndpoint
from .endpoints.user_index import UserIndexEndpoint
from .endpoints.user_details import UserDetailsEndpoint
from .endpoints.user_emails import UserEmailsEndpoint
from .endpoints.user_emails_confirm import UserEmailsConfirmEndpoint
from .endpoints.user_ips import UserIPsEndpoint
from .endpoints.user_organizations import UserOrganizationsEndpoint
from .endpoints.user_notification_details import UserNotificationDetailsEndpoint
from .endpoints.user_password import UserPasswordEndpoint
from .endpoints.user_notification_fine_tuning import UserNotificationFineTuningEndpoint
from .endpoints.user_social_identities_index import UserSocialIdentitiesIndexEndpoint
from .endpoints.user_social_identity_details import UserSocialIdentityDetailsEndpoint
from .endpoints.user_subscriptions import UserSubscriptionsEndpoint
from .endpoints.event_file_committers import EventFileCommittersEndpoint
from .endpoints.setup_wizard import SetupWizard


urlpatterns = patterns(
    '',

    # Relay
    url(
        r'^relays/$',
        RelayIndexEndpoint.as_view(),
        name='sentry-api-0-relays-index'
    ),

    url(
        r'^relays/register/challenge/$',
        RelayRegisterChallengeEndpoint.as_view(),
        name='sentry-api-0-relay-register-challenge'
    ),

    url(
        r'^relays/register/response/$',
        RelayRegisterResponseEndpoint.as_view(),
        name='sentry-api-0-relay-register-response'
    ),

    url(
        r'^relays/heartbeat/$',
        RelayHeartbeatEndpoint.as_view(),
        name='sentry-api-0-relay-heartbeat'
    ),

    url(
        r'^relays/projectconfigs/$',
        RelayProjectConfigsEndpoint.as_view(),
        name='sentry-api-0-relay-projectconfigs'
    ),

    url(
        r'^relays/publickeys/$',
        RelayPublicKeysEndpoint.as_view(),
        name='sentry-api-0-relay-publickeys'
    ),

    url(
        r'^relays/(?P<relay_id>[^\/]+)/$',
        RelayDetailsEndpoint.as_view(),
        name='sentry-api-0-relays-details'
    ),

    # Api Data
    url(
        r'^assistant/$',
        AssistantEndpoint.as_view(),
        name='sentry-api-0-assistant',
    ),
    url(
        r'^api-applications/$',
        ApiApplicationsEndpoint.as_view(),
        name='sentry-api-0-api-applications'
    ),
    url(
        r'^api-applications/(?P<app_id>[^\/]+)/$',
        ApiApplicationDetailsEndpoint.as_view(),
        name='sentry-api-0-api-application-details'
    ),
    url(
        r'^api-authorizations/$',
        ApiAuthorizationsEndpoint.as_view(),
        name='sentry-api-0-api-authorizations'
    ),
    url(r'^api-tokens/$', ApiTokensEndpoint.as_view(),
        name='sentry-api-0-api-tokens'),

    # Auth
    url(r'^auth/$', AuthIndexEndpoint.as_view(), name='sentry-api-0-auth'),

    # List Authentiactors
    url(r'^authenticators/$',
        AuthenticatorIndexEndpoint.as_view(),
        name='sentry-api-0-authenticator-index'),

    # Broadcasts
    url(r'^broadcasts/$', BroadcastIndexEndpoint.as_view(),
        name='sentry-api-0-broadcast-index'),
    url(r'^broadcasts/(?P<broadcast_id>[^\/]+)/$', BroadcastDetailsEndpoint.as_view()),

    # Project transfer
    url(r'^accept-transfer/$', AcceptProjectTransferEndpoint.as_view(),
        name='sentry-api-0-accept-project-transfer'),

    # Users
    url(r'^users/$', UserIndexEndpoint.as_view(), name='sentry-api-0-user-index'),
    url(
        r'^users/(?P<user_id>[^\/]+)/$',
        UserDetailsEndpoint.as_view(),
        name='sentry-api-0-user-details'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/avatar/$',
        UserAvatarEndpoint.as_view(),
        name='sentry-api-0-user-avatar'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/appearance/$',
        UserAppearanceEndpoint.as_view(),
        name='sentry-api-0-user-appearance'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/authenticators/$',
        UserAuthenticatorIndexEndpoint.as_view(),
        name='sentry-api-0-user-authenticator-index'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/authenticators/(?P<interface_id>[^\/]+)/enroll/$',
        UserAuthenticatorEnrollEndpoint.as_view(),
        name='sentry-api-0-user-authenticator-enroll'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/authenticators/(?P<auth_id>[^\/]+)/(?P<interface_device_id>[^\/]+)/$',
        UserAuthenticatorDetailsEndpoint.as_view(),
        name='sentry-api-0-user-authenticator-device-details'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/authenticators/(?P<auth_id>[^\/]+)/$',
        UserAuthenticatorDetailsEndpoint.as_view(),
        name='sentry-api-0-user-authenticator-details'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/emails/$',
        UserEmailsEndpoint.as_view(),
        name='sentry-api-0-user-emails'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/emails/confirm/$',
        UserEmailsConfirmEndpoint.as_view(),
        name='sentry-api-0-user-emails-confirm'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/identities/(?P<identity_id>[^\/]+)/$',
        UserIdentityDetailsEndpoint.as_view(),
        name='sentry-api-0-user-identity-details'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/ips/$',
        UserIPsEndpoint.as_view(),
        name='sentry-api-0-user-ips'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/organizations/$',
        UserOrganizationsEndpoint.as_view(),
        name='sentry-api-0-user-organizations'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/notifications/$',
        UserNotificationDetailsEndpoint.as_view(),
        name='sentry-api-0-user-notifications'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/password/$',
        UserPasswordEndpoint.as_view(),
        name='sentry-api-0-user-password'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/notifications/(?P<notification_type>[^\/]+)/$',
        UserNotificationFineTuningEndpoint.as_view(),
        name='sentry-api-0-user-notifications-fine-tuning'
    ),
    url(
        r'^users/(?P<user_id>[^\/]+)/social-identities/$',
        UserSocialIdentitiesIndexEndpoint.as_view(),
        name='sentry-api-0-user-social-identities-index'),
    url(
        r'^users/(?P<user_id>[^\/]+)/social-identities/(?P<identity_id>[^\/]+)/$',
        UserSocialIdentityDetailsEndpoint.as_view(),
        name='sentry-api-0-user-social-identity-details'),
    url(
        r'^users/(?P<user_id>[^\/]+)/subscriptions/$',
        UserSubscriptionsEndpoint.as_view(),
        name='sentry-api-0-user-subscriptions'
    ),

    # Organizations

    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/chunk-upload/$',
        ChunkUploadEndpoint.as_view(),
        name='sentry-api-0-chunk-upload'
    ),
    url(
        r'^organizations/$', OrganizationIndexEndpoint.as_view(), name='sentry-api-0-organizations'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/$',
        OrganizationDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-details'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/discover/$',
        OrganizationDiscoverEndpoint.as_view(),
        name='sentry-api-0-organization-discover'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/health/top/$',
        OrganizationHealthTopEndpoint.as_view(),
        name='sentry-api-0-organization-health-top',
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/shortids/(?P<short_id>[^\/]+)/$',
        ShortIdLookupEndpoint.as_view(),
        name='sentry-api-0-short-id-lookup'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/eventids/(?P<event_id>[^\/]+)/$',
        EventIdLookupEndpoint.as_view(),
        name='sentry-api-0-event-id-lookup'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/slugs/$',
        SlugsUpdateEndpoint.as_view(),
        name='sentry-api-0-short-ids-update'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/access-requests/$',
        OrganizationAccessRequestDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-access-requests'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/access-requests/(?P<request_id>\d+)/$',
        OrganizationAccessRequestDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-access-request-details'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/activity/$',
        OrganizationActivityEndpoint.as_view(),
        name='sentry-api-0-organization-activity'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/api-keys/$',
        OrganizationApiKeyIndexEndpoint.as_view(),
        name='sentry-api-0-organization-api-key-index'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/api-keys/(?P<api_key_id>[^\/]+)/$',
        OrganizationApiKeyDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-api-key-details'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/audit-logs/$',
        OrganizationAuditLogsEndpoint.as_view(),
        name='sentry-api-0-organization-audit-logs'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/auth-provider/$',
        OrganizationAuthProviderDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-auth-provider'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/auth-providers/$',
        OrganizationAuthProvidersEndpoint.as_view(),
        name='sentry-api-0-organization-auth-providers'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/auth-provider/send-reminders/$',
        OrganizationAuthProviderSendRemindersEndpoint.as_view(),
        name='sentry-api-0-organization-auth-provider-send-reminders'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/avatar/$',
        OrganizationAvatarEndpoint.as_view(),
        name='sentry-api-0-organization-avatar'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/config/integrations/$',
        OrganizationConfigIntegrationsEndpoint.as_view(),
        name='sentry-api-0-organization-config-integrations'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/config/repos/$',
        OrganizationConfigRepositoriesEndpoint.as_view(),
        name='sentry-api-0-organization-config-repositories'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/issues/new/$',
        OrganizationIssuesNewEndpoint.as_view(),
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/integrations/$',
        OrganizationIntegrationsEndpoint.as_view(),
        name='sentry-api-0-organization-integrations'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/integrations/(?P<integration_id>[^\/]+)/$',
        OrganizationIntegrationDetailsEndpoint.as_view(),
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/integrations/(?P<integration_id>[^\/]+)/repos/$',
        OrganizationIntegrationReposEndpoint.as_view(),
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/members/$',
        OrganizationMemberIndexEndpoint.as_view(),
        name='sentry-api-0-organization-member-index'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/users/issues/$',
        OrganizationUserIssuesSearchEndpoint.as_view(),
        name='sentry-api-0-organization-issue-search'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/users/(?P<user_id>[^\/]+)/issues/$',
        OrganizationUserIssuesEndpoint.as_view(),
        name='sentry-api-0-organization-user-issues'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/$',
        OrganizationMemberDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-member-details'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/unreleased-commits/$',
        OrganizationMemberUnreleasedCommitsEndpoint.as_view(),
        name='sentry-api-0-organization-member-unreleased-commits'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/issues/assigned/$',
        OrganizationMemberIssuesAssignedEndpoint.as_view(),
        name='sentry-api-0-organization-member-issues-assigned'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/issues/bookmarked/$',
        OrganizationMemberIssuesBookmarkedEndpoint.as_view(),
        name='sentry-api-0-organization-member-issues-bookmarked'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/issues/viewed/$',
        OrganizationMemberIssuesViewedEndpoint.as_view(),
        name='sentry-api-0-organization-member-issues-viewed'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/teams/(?P<team_slug>[^\/]+)/$',
        OrganizationMemberTeamDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-member-team-details'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/projects/$',
        OrganizationProjectsEndpoint.as_view(),
        name='sentry-api-0-organization-projects'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/repos/$',
        OrganizationRepositoriesEndpoint.as_view(),
        name='sentry-api-0-organization-repositories'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/repos/(?P<repo_id>[^\/]+)/$',
        OrganizationRepositoryDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-repository-details'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/repos/(?P<repo_id>[^\/]+)/commits/$',
        OrganizationRepositoryCommitsEndpoint.as_view(),
        name='sentry-api-0-organization-repository-commits'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/plugins/$',
        OrganizationPluginsEndpoint.as_view(),
        name='sentry-api-0-organization-plugins'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/releases/$',
        OrganizationReleasesEndpoint.as_view(),
        name='sentry-api-0-organization-releases'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/$',
        OrganizationReleaseDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-release-details'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/files/$',
        OrganizationReleaseFilesEndpoint.as_view(),
        name='sentry-api-0-organization-release-files'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/files/(?P<file_id>\d+)/$',
        OrganizationReleaseFileDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-release-file-details'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/commitfiles/$',
        CommitFileChangeEndpoint.as_view(),
        name='sentry-api-0-release-commitfilechange'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/deploys/$',
        ReleaseDeploysEndpoint.as_view(),
        name='sentry-api-0-organization-release-deploys'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/releases/(?P<version>[^/]+)/commits/$',
        OrganizationReleaseCommitsEndpoint.as_view(),
        name='sentry-api-0-organization-release-commits'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/stats/$',
        OrganizationStatsEndpoint.as_view(),
        name='sentry-api-0-organization-stats'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/teams/$',
        OrganizationTeamsEndpoint.as_view(),
        name='sentry-api-0-organization-teams'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/onboarding-tasks/$',
        OrganizationOnboardingTaskEndpoint.as_view(),
        name='sentry-api-0-organization-onboardingtasks'
    ),
    url(
        r'^organizations/(?P<organization_slug>[^\/]+)/environments/$',
        OrganizationEnvironmentsEndpoint.as_view(),
        name='sentry-api-0-organization-environments',
    ),

    # Teams
    url(
        r'^teams/(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/$',
        TeamDetailsEndpoint.as_view(),
        name='sentry-api-0-team-details'
    ),
    url(
        r'^teams/(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/(?:issues|groups)/new/$',
        TeamGroupsNewEndpoint.as_view(),
        name='sentry-api-0-team-groups-new'
    ),
    url(
        r'^teams/(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/(?:issues|groups)/trending/$',
        TeamGroupsTrendingEndpoint.as_view(),
        name='sentry-api-0-team-groups-trending'
    ),
    url(
        r'^teams/(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/members/$',
        TeamMembersEndpoint.as_view(),
        name='sentry-api-0-team-members'
    ),
    url(
        r'^teams/(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/projects/$',
        TeamProjectsEndpoint.as_view(),
        name='sentry-api-0-team-project-index'
    ),
    url(
        r'^teams/(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/stats/$',
        TeamStatsEndpoint.as_view(),
        name='sentry-api-0-team-stats'
    ),
    url(
        r'^teams/(?P<organization_slug>[^\/]+)/(?P<team_slug>[^\/]+)/avatar/$',
        TeamAvatarEndpoint.as_view(),
        name='sentry-api-0-team-avatar'
    ),

    # Projects
    url(r'^projects/$', ProjectIndexEndpoint.as_view(),
        name='sentry-api-0-projects'),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/$',
        ProjectDetailsEndpoint.as_view(),
        name='sentry-api-0-project-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/avatar/$',
        ProjectAvatarEndpoint.as_view(),
        name='sentry-api-0-project-avatar'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/create-sample/$',
        ProjectCreateSampleEndpoint.as_view(),
        name='sentry-api-0-project-create-sample'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/docs/$',
        ProjectDocsEndpoint.as_view(),
        name='sentry-api-0-project-docs'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/docs/(?P<platform>[\w-]+)/$',
        ProjectDocsPlatformEndpoint.as_view(),
        name='sentry-api-0-project-docs-platform'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/environments/$',
        ProjectEnvironmentsEndpoint.as_view(),
        name='sentry-api-0-project-environments'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/environments/(?P<environment>[^/]+)/$',
        ProjectEnvironmentDetailsEndpoint.as_view(),
        name='sentry-api-0-project-environment-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/platforms/$',
        ProjectPlatformsEndpoint.as_view(),
        name='sentry-api-0-project-platform-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/$',
        ProjectEventsEndpoint.as_view(),
        name='sentry-api-0-project-events'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/$',
        ProjectEventDetailsEndpoint.as_view(),
        name='sentry-api-0-project-event-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/attachments/$',
        EventAttachmentsEndpoint.as_view(),
        name='sentry-api-0-event-attachments'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/attachments/(?P<attachment_id>[\w-]+)/$',
        EventAttachmentDetailsEndpoint.as_view(),
        name='sentry-api-0-event-attachment-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/committers/$',
        EventFileCommittersEndpoint.as_view(),
        name='sentry-api-0-event-file-committers'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/events/(?P<event_id>[\w-]+)/owners/$',
        EventOwnersEndpoint.as_view(),
        name='sentry-api-0-event-owners'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/files/dsyms/$',
        DSymFilesEndpoint.as_view(),
        name='sentry-api-0-dsym-files'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/files/difs/assemble/$',
        DifAssembleEndpoint.as_view(),
        name='sentry-api-0-assemble-dif-files'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/files/dsyms/unknown/$',
        UnknownDSymFilesEndpoint.as_view(),
        name='sentry-api-0-unknown-dsym-files'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/files/dsyms/associate/$',
        AssociateDSymFilesEndpoint.as_view(),
        name='sentry-api-0-associate-dsym-files'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/filters/$',
        ProjectFiltersEndpoint.as_view(),
        name='sentry-api-0-project-filters'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/filters/(?P<filter_id>[\w-]+)/$',
        ProjectFilterDetailsEndpoint.as_view(),
        name='sentry-api-0-project-filters'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/hooks/$',
        ProjectServiceHooksEndpoint.as_view(),
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/hooks/(?P<hook_id>[^\/]+)/$',
        ProjectServiceHookDetailsEndpoint.as_view(),
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/hooks/(?P<hook_id>[^\/]+)/stats/$',
        ProjectServiceHookStatsEndpoint.as_view(),
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/(?:issues|groups)/$',
        ProjectGroupIndexEndpoint.as_view(),
        name='sentry-api-0-project-group-index'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/(?:issues|groups)/stats/$',
        ProjectGroupStatsEndpoint.as_view(),
        name='sentry-api-0-project-group-stats'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/keys/$',
        ProjectKeysEndpoint.as_view(),
        name='sentry-api-0-project-keys'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/keys/(?P<key_id>[^\/]+)/$',
        ProjectKeyDetailsEndpoint.as_view(),
        name='sentry-api-0-project-key-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/keys/(?P<key_id>[^\/]+)/stats/$',
        ProjectKeyStatsEndpoint.as_view()
    ),
    url(
        r'^projects/(?P<organization_slug>[^/]+)/(?P<project_slug>[^/]+)/members/$',
        ProjectMemberIndexEndpoint.as_view(),
        name='sentry-api-0-project-member-index'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/$',
        ProjectReleasesEndpoint.as_view(),
        name='sentry-api-0-project-releases'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/token/$',
        ProjectReleasesTokenEndpoint.as_view(),
        name='sentry-api-0-project-releases-token'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/$',
        ProjectReleaseDetailsEndpoint.as_view(),
        name='sentry-api-0-project-release-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/commits/$',
        ProjectReleaseCommitsEndpoint.as_view(),
        name='sentry-api-0-project-release-commits'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/resolved/$',
        IssuesResolvedInReleaseEndpoint.as_view(),
        name='sentry-api-0-release-resolved'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/files/$',
        ProjectReleaseFilesEndpoint.as_view(),
        name='sentry-api-0-project-release-files'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/releases/(?P<version>[^/]+)/files/(?P<file_id>\d+)/$',
        ProjectReleaseFileDetailsEndpoint.as_view(),
        name='sentry-api-0-project-release-file-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/rules/$',
        ProjectRulesEndpoint.as_view(),
        name='sentry-api-0-project-rules'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/rules/configuration/$',
        ProjectRulesConfigurationEndpoint.as_view(),
        name='sentry-api-0-project-rules-configuration'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/rules/(?P<rule_id>[^\/]+)/$',
        ProjectRuleDetailsEndpoint.as_view(),
        name='sentry-api-0-project-rule-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/searches/$',
        ProjectSearchesEndpoint.as_view(),
        name='sentry-api-0-project-searches'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/searches/(?P<search_id>[^\/]+)/$',
        ProjectSearchDetailsEndpoint.as_view(),
        name='sentry-api-0-project-search-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/stats/$',
        ProjectStatsEndpoint.as_view(),
        name='sentry-api-0-project-stats'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tags/$',
        ProjectTagsEndpoint.as_view(),
        name='sentry-api-0-project-tags'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tags/(?P<key>[^/]+)/$',
        ProjectTagKeyDetailsEndpoint.as_view(),
        name='sentry-api-0-project-tagkey-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tags/(?P<key>[^/]+)/values/$',
        ProjectTagKeyValuesEndpoint.as_view(),
        name='sentry-api-0-project-tagkey-values'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/teams/$',
        ProjectTeamsEndpoint.as_view(),
        name='sentry-api-0-project-teams'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/teams/(?P<team_slug>[^\/]+)/$',
        ProjectTeamDetailsEndpoint.as_view(),
        name='sentry-api-0-project-team-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/transfer/$',
        ProjectTransferEndpoint.as_view(),
        name='sentry-api-0-project-transfer'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/users/$',
        ProjectUsersEndpoint.as_view(),
        name='sentry-api-0-project-users'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/users/(?P<user_hash>[^/]+)/$',
        ProjectUserDetailsEndpoint.as_view(),
        name='sentry-api-0-project-user-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/(?:user-feedback|user-reports)/$',
        ProjectUserReportsEndpoint.as_view(),
        name='sentry-api-0-project-user-reports'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/user-stats/$',
        ProjectUserStatsEndpoint.as_view(),
        name='sentry-api-0-project-userstats'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/processingissues/$',
        ProjectProcessingIssuesEndpoint.as_view(),
        name='sentry-api-0-project-processing-issues'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/processingissues/fix$',
        ProjectProcessingIssuesFixEndpoint.as_view(),
        name='sentry-api-0-project-fix-processing-issues'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/reprocessing/$',
        ProjectReprocessingEndpoint.as_view(),
        name='sentry-api-0-project-reprocessing'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/processingissues/discard/$',
        ProjectProcessingIssuesDiscardEndpoint.as_view(),
        name='sentry-api-0-project-discard-processing-issues'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/ownership/$',
        ProjectOwnershipEndpoint.as_view(),
        name='sentry-api-0-project-ownership'
    ),

    # Load plugin project urls
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/plugins/$',
        ProjectPluginsEndpoint.as_view(),
        name='sentry-api-0-project-plugins'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/plugins/(?P<plugin_id>[^\/]+)/$',
        ProjectPluginDetailsEndpoint.as_view(),
        name='sentry-api-0-project-plugin-details'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/plugins?/',
        include('sentry.plugins.base.project_api_urls')
    ),

    # Groups
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/$',
        GroupDetailsEndpoint.as_view(),
        name='sentry-api-0-group-details'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/events/$',
        GroupEventsEndpoint.as_view(),
        name='sentry-api-0-group-events'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/events/latest/$',
        GroupEventsLatestEndpoint.as_view(),
        name='sentry-api-0-group-events-latest'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/events/oldest/$',
        GroupEventsOldestEndpoint.as_view(),
        name='sentry-api-0-group-events-oldest'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/(?:notes|comments)/$',
        GroupNotesEndpoint.as_view(),
        name='sentry-api-0-group-notes'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/(?:notes|comments)/(?P<note_id>[^\/]+)/$',
        GroupNotesDetailsEndpoint.as_view(),
        name='sentry-api-0-group-notes-details'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/hashes/$',
        GroupHashesEndpoint.as_view(),
        name='sentry-api-0-group-events'
    ),
    url(
        r'^issues/(?P<issue_id>\d+)/participants/$',
        GroupParticipantsEndpoint.as_view(),
        name='sentry-api-0-group-stats'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/stats/$',
        GroupStatsEndpoint.as_view(),
        name='sentry-api-0-group-stats'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/tags/$',
        GroupTagsEndpoint.as_view(),
        name='sentry-api-0-group-tags'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/tags/(?P<key>[^/]+)/$',
        GroupTagKeyDetailsEndpoint.as_view(),
        name='sentry-api-0-group-tagkey-details'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/tags/(?P<key>[^/]+)/values/$',
        GroupTagKeyValuesEndpoint.as_view(),
        name='sentry-api-0-group-tagkey-values'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/(?:user-feedback|user-reports)/$',
        GroupUserReportsEndpoint.as_view(),
        name='sentry-api-0-group-user-reports'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/similar/$',
        GroupSimilarIssuesEndpoint.as_view(),
        name='sentry-api-0-group-similar-issues'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/integrations/$',
        GroupIntegrationsEndpoint.as_view(),
        name='sentry-api-0-group-integrations'
    ),
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/integrations/(?P<integration_id>\d+)/$',
        GroupIntegrationDetailsEndpoint.as_view(),
        name='sentry-api-0-group-integration-details'
    ),
    # Load plugin group urls
    url(
        r'^(?:issues|groups)/(?P<issue_id>\d+)/plugins?/',
        include('sentry.plugins.base.group_api_urls')
    ),
    url(
        r'^shared/(?:issues|groups)/(?P<share_id>[^\/]+)/$',
        SharedGroupDetailsEndpoint.as_view(),
        name='sentry-api-0-shared-group-details'
    ),

    # Tombstone
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tombstones/$',
        GroupTombstoneEndpoint.as_view(),
        name='sentry-api-0-group-tombstones'
    ),
    url(
        r'^projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/tombstones/(?P<tombstone_id>\d+)/$',
        GroupTombstoneDetailsEndpoint.as_view(),
        name='sentry-api-0-group-tombstone-details'
    ),

    # Events
    url(
        r'^events/(?P<event_id>\d+)/$',
        EventDetailsEndpoint.as_view(),
        name='sentry-api-0-event-details'
    ),
    url(
        r'^events/(?P<event_id>\d+)/apple-crash-report$',
        EventAppleCrashReportEndpoint.as_view(),
        name='sentry-api-0-event-apple-crash-report'
    ),

    # Internal
    url(r'^internal/health/$', SystemHealthEndpoint.as_view(),
        name='sentry-api-0-system-health'),
    url(
        r'^internal/options/$', SystemOptionsEndpoint.as_view(), name='sentry-api-0-system-options'
    ),
    url(r'^internal/quotas/$', InternalQuotasEndpoint.as_view()),
    url(r'^internal/queue/tasks/$', InternalQueueTasksEndpoint.as_view()),
    url(r'^internal/stats/$', InternalStatsEndpoint.as_view(),
        name='sentry-api-0-internal-stats'),

    # Project Wizard
    url(
        r'^wizard/$',
        SetupWizard.as_view(),
        name='sentry-api-0-project-wizard-new'
    ),

    url(
        r'^wizard/(?P<wizard_hash>[^\/]+)/$',
        SetupWizard.as_view(),
        name='sentry-api-0-project-wizard'
    ),

    # Catch all
    url(r'^$', IndexEndpoint.as_view(), name='sentry-api-index'),
    url(r'^', CatchallEndpoint.as_view(), name='sentry-api-catchall'),

    # url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework'))
)
