# HACK(jferge): endpoints documented with previous tooling w/ manual openAPI JSON are listed below
# TODO: convert these to new api tooling
from sentry.api.endpoints.codeowners import ExternalTeamDetailsEndpoint
from sentry.api.endpoints.debug_files import DebugFilesEndpoint, UnknownDebugFilesEndpoint
from sentry.api.endpoints.filechange import CommitFileChangeEndpoint
from sentry.api.endpoints.group_details import GroupDetailsEndpoint
from sentry.api.endpoints.group_events import GroupEventsEndpoint
from sentry.api.endpoints.group_events_latest import GroupEventsLatestEndpoint
from sentry.api.endpoints.group_events_oldest import GroupEventsOldestEndpoint
from sentry.api.endpoints.group_hashes import GroupHashesEndpoint
from sentry.api.endpoints.group_tagkey_details import GroupTagKeyDetailsEndpoint
from sentry.api.endpoints.group_tagkey_values import GroupTagKeyValuesEndpoint
from sentry.api.endpoints.organization_details import OrganizationDetailsEndpoint
from sentry.api.endpoints.organization_eventid import EventIdLookupEndpoint
from sentry.api.endpoints.organization_index import OrganizationIndexEndpoint
from sentry.api.endpoints.organization_member.team_details import (
    OrganizationMemberTeamDetailsEndpoint,
)
from sentry.api.endpoints.organization_projects import OrganizationProjectsEndpoint
from sentry.api.endpoints.organization_release_commits import OrganizationReleaseCommitsEndpoint
from sentry.api.endpoints.organization_release_details import OrganizationReleaseDetailsEndpoint
from sentry.api.endpoints.organization_release_file_details import (
    OrganizationReleaseFileDetailsEndpoint,
)
from sentry.api.endpoints.organization_release_files import OrganizationReleaseFilesEndpoint
from sentry.api.endpoints.organization_releases import OrganizationReleasesEndpoint
from sentry.api.endpoints.organization_repositories import OrganizationRepositoriesEndpoint
from sentry.api.endpoints.organization_repository_commits import (
    OrganizationRepositoryCommitsEndpoint,
)
from sentry.api.endpoints.organization_sessions import OrganizationSessionsEndpoint
from sentry.api.endpoints.organization_shortid import ShortIdLookupEndpoint
from sentry.api.endpoints.organization_stats import OrganizationStatsEndpoint
from sentry.api.endpoints.organization_stats_v2 import OrganizationStatsEndpointV2
from sentry.api.endpoints.organization_teams import OrganizationTeamsEndpoint
from sentry.api.endpoints.organization_users import OrganizationUsersEndpoint
from sentry.api.endpoints.project_details import ProjectDetailsEndpoint
from sentry.api.endpoints.project_event_details import ProjectEventDetailsEndpoint
from sentry.api.endpoints.project_events import ProjectEventsEndpoint
from sentry.api.endpoints.project_group_index import ProjectGroupIndexEndpoint
from sentry.api.endpoints.project_index import ProjectIndexEndpoint
from sentry.api.endpoints.project_issues_resolved_in_release import (
    ProjectIssuesResolvedInReleaseEndpoint,
)
from sentry.api.endpoints.project_key_details import ProjectKeyDetailsEndpoint
from sentry.api.endpoints.project_keys import ProjectKeysEndpoint
from sentry.api.endpoints.project_release_commits import ProjectReleaseCommitsEndpoint
from sentry.api.endpoints.project_release_file_details import ProjectReleaseFileDetailsEndpoint
from sentry.api.endpoints.project_release_files import ProjectReleaseFilesEndpoint
from sentry.api.endpoints.project_servicehook_details import ProjectServiceHookDetailsEndpoint
from sentry.api.endpoints.project_servicehooks import ProjectServiceHooksEndpoint
from sentry.api.endpoints.project_stats import ProjectStatsEndpoint
from sentry.api.endpoints.project_tagkey_values import ProjectTagKeyValuesEndpoint
from sentry.api.endpoints.project_team_details import ProjectTeamDetailsEndpoint
from sentry.api.endpoints.project_user_reports import ProjectUserReportsEndpoint
from sentry.api.endpoints.project_users import ProjectUsersEndpoint
from sentry.api.endpoints.release_deploys import ReleaseDeploysEndpoint
from sentry.api.endpoints.shared_group_details import SharedGroupDetailsEndpoint
from sentry.api.endpoints.team_details import TeamDetailsEndpoint
from sentry.api.endpoints.team_projects import TeamProjectsEndpoint
from sentry.api.endpoints.team_stats import TeamStatsEndpoint

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


PUBLIC_ENDPOINTS_FROM_JSON = {f"{v.__module__}.{v.__name__}" for v in __PUBLIC_ENDPOINTS_FROM_JSON}
