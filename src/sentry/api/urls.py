from __future__ import absolute_import

from django.conf.urls import patterns, url

from .endpoints.auth_index import AuthIndexEndpoint
from .endpoints.broadcast_index import BroadcastIndexEndpoint
from .endpoints.catchall import CatchallEndpoint
from .endpoints.event_details import EventDetailsEndpoint
from .endpoints.group_details import GroupDetailsEndpoint
from .endpoints.group_markseen import GroupMarkSeenEndpoint
from .endpoints.group_events import GroupEventsEndpoint
from .endpoints.group_events_latest import GroupEventsLatestEndpoint
from .endpoints.group_notes import GroupNotesEndpoint
from .endpoints.group_stats import GroupStatsEndpoint
from .endpoints.group_tags import GroupTagsEndpoint
from .endpoints.organization_member_details import OrganizationMemberDetailsEndpoint
from .endpoints.organization_projects import OrganizationProjectsEndpoint
from .endpoints.organization_stats import OrganizationStatsEndpoint
from .endpoints.organization_teams import OrganizationTeamsEndpoint
from .endpoints.project_details import ProjectDetailsEndpoint
from .endpoints.project_group_index import ProjectGroupIndexEndpoint
from .endpoints.project_releases import ProjectReleasesEndpoint
from .endpoints.project_stats import ProjectStatsEndpoint
from .endpoints.project_tagkey_details import ProjectTagKeyDetailsEndpoint
from .endpoints.release_details import ReleaseDetailsEndpoint
from .endpoints.team_details import TeamDetailsEndpoint
from .endpoints.team_access_group_index import TeamAccessGroupIndexEndpoint
from .endpoints.team_groups_new import TeamGroupsNewEndpoint
from .endpoints.team_groups_trending import TeamGroupsTrendingEndpoint
from .endpoints.team_project_index import TeamProjectIndexEndpoint
from .endpoints.team_stats import TeamStatsEndpoint
from .endpoints.user_details import UserDetailsEndpoint


urlpatterns = patterns(
    '',

    # Auth
    url(r'^auth/$',
        AuthIndexEndpoint.as_view(),
        name='sentry-api-0-auth'),

    # Broadcasts
    url(r'^broadcasts/$',
        BroadcastIndexEndpoint.as_view(),
        name='sentry-api-0-broadcast-index'),

    # Users
    url(r'^users/(?P<user_id>[^\/]+)/$',
        UserDetailsEndpoint.as_view(),
        name='sentry-api-0-user-details'),

    # Organizations
    url(r'^organizations/(?P<organization_slug>[^\/]+)/members/(?P<member_id>\d+)/$',
        OrganizationMemberDetailsEndpoint.as_view(),
        name='sentry-api-0-organization-member-details'),
    url(r'^organizations/(?P<organization_slug>[^\/]+)/projects/$',
        OrganizationProjectsEndpoint.as_view(),
        name='sentry-api-0-organization-projects'),
    url(r'^organizations/(?P<organization_slug>[^\/]+)/stats/$',
        OrganizationStatsEndpoint.as_view(),
        name='sentry-api-0-organization-stats'),
    url(r'^organizations/(?P<organization_slug>[^\/]+)/teams/$',
        OrganizationTeamsEndpoint.as_view(),
        name='sentry-api-0-organization-teams'),

    # Teams
    url(r'^teams/(?P<team_id>\d+)/$',
        TeamDetailsEndpoint.as_view(),
        name='sentry-api-0-team-details'),
    url(r'^teams/(?P<team_id>\d+)/groups/new/$',
        TeamGroupsNewEndpoint.as_view(),
        name='sentry-api-0-team-groups-new'),
    url(r'^teams/(?P<team_id>\d+)/groups/trending/$',
        TeamGroupsTrendingEndpoint.as_view(),
        name='sentry-api-0-team-groups-trending'),
    url(r'^teams/(?P<team_id>\d+)/projects/$',
        TeamProjectIndexEndpoint.as_view(),
        name='sentry-api-0-team-project-index'),
    url(r'^teams/(?P<team_id>\d+)/access-groups/$',
        TeamAccessGroupIndexEndpoint.as_view(),
        name='sentry-api-0-team-access-group-index'),
    url(r'^teams/(?P<team_id>\d+)/stats/$',
        TeamStatsEndpoint.as_view(),
        name='sentry-api-0-team-stats'),

    # Projects
    url(r'^projects/(?P<project_id>\d+)/$',
        ProjectDetailsEndpoint.as_view(),
        name='sentry-api-0-project-details'),
    url(r'^projects/(?P<project_id>\d+)/groups/$',
        ProjectGroupIndexEndpoint.as_view(),
        name='sentry-api-0-project-group-index'),
    url(r'^projects/(?P<project_id>\d+)/releases/$',
        ProjectReleasesEndpoint.as_view(),
        name='sentry-api-0-project-releases'),
    url(r'^projects/(?P<project_id>\d+)/stats/$',
        ProjectStatsEndpoint.as_view(),
        name='sentry-api-0-project-stats'),
    url(r'^projects/(?P<project_id>\d+)/tags/(?P<key>[^/]+)/$',
        ProjectTagKeyDetailsEndpoint.as_view(),
        name='sentry-api-0-project-tagkey-details'),

    # Releases
    url(r'^releases/(?P<release_id>\d+)/$',
        ReleaseDetailsEndpoint.as_view(),
        name='sentry-api-0-release-details'),

    # Groups
    url(r'^groups/(?P<group_id>\d+)/$',
        GroupDetailsEndpoint.as_view(),
        name='sentry-api-0-group-details'),
    url(r'^groups/(?P<group_id>\d+)/markseen/$',
        GroupMarkSeenEndpoint.as_view(),
        name='sentry-api-0-group-markseen'),
    url(r'^groups/(?P<group_id>\d+)/events/$',
        GroupEventsEndpoint.as_view(),
        name='sentry-api-0-group-events'),
    url(r'^groups/(?P<group_id>\d+)/events/latest/$',
        GroupEventsLatestEndpoint.as_view(),
        name='sentry-api-0-group-events-latest'),
    url(r'^groups/(?P<group_id>\d+)/notes/$',
        GroupNotesEndpoint.as_view(),
        name='sentry-api-0-group-notes'),
    url(r'^groups/(?P<group_id>\d+)/stats/$',
        GroupStatsEndpoint.as_view(),
        name='sentry-api-0-group-stats'),
    url(r'^groups/(?P<group_id>\d+)/tags/$',
        GroupTagsEndpoint.as_view(),
        name='sentry-api-0-group-tags'),

    # Events
    url(r'^events/(?P<event_id>\d+)/$',
        EventDetailsEndpoint.as_view(),
        name='sentry-api-0-event-details'),

    url(r'^',
        CatchallEndpoint.as_view(),
        name='sentry-api-catchall'),

    # url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework'))
)
