from __future__ import absolute_import

from django.conf.urls import patterns, url

from .endpoints.auth_index import AuthIndexEndpoint
from .endpoints.catchall import CatchallEndpoint
from .endpoints.event_details import EventDetailsEndpoint
from .endpoints.group_assign import GroupAssignEndpoint
from .endpoints.group_details import GroupDetailsEndpoint
from .endpoints.group_resolve import GroupResolveEndpoint
from .endpoints.group_bookmark import GroupBookmarkEndpoint
from .endpoints.group_markseen import GroupMarkSeenEndpoint
from .endpoints.group_delete import GroupDeleteEndpoint
from .endpoints.group_events import GroupEventsEndpoint
from .endpoints.group_events_latest import GroupEventsLatestEndpoint
from .endpoints.group_notes import GroupNotesEndpoint
from .endpoints.group_stats import GroupStatsEndpoint
from .endpoints.group_tags import GroupTagsEndpoint
from .endpoints.project_details import ProjectDetailsEndpoint
from .endpoints.project_index import ProjectIndexEndpoint
from .endpoints.project_group_index import ProjectGroupIndexEndpoint
from .endpoints.project_releases import ProjectReleasesEndpoint
from .endpoints.project_stats import ProjectStatsEndpoint
from .endpoints.team_details import TeamDetailsEndpoint
from .endpoints.team_index import TeamIndexEndpoint
from .endpoints.team_access_group_index import TeamAccessGroupIndexEndpoint
from .endpoints.team_project_index import TeamProjectIndexEndpoint
from .endpoints.team_member_index import TeamMemberIndexEndpoint
from .endpoints.team_stats import TeamStatsEndpoint
from .endpoints.user_details import UserDetailsEndpoint


urlpatterns = patterns(
    '',

    # Auth
    url(r'^auth/$',
        AuthIndexEndpoint.as_view(),
        name='sentry-api-0-auth'),

    # Users
    url(r'^users/(?P<user_id>[^\/]+)/$',
        UserDetailsEndpoint.as_view(),
        name='sentry-api-0-user-details'),

    # Teams
    url(r'^teams/$',
        TeamIndexEndpoint.as_view(),
        name='sentry-api-0-team-index'),
    url(r'^teams/(?P<team_id>\d+)/$',
        TeamDetailsEndpoint.as_view(),
        name='sentry-api-0-team-details'),
    url(r'^teams/(?P<team_id>\d+)/projects/$',
        TeamProjectIndexEndpoint.as_view(),
        name='sentry-api-0-team-project-index'),
    url(r'^teams/(?P<team_id>\d+)/members/$',
        TeamMemberIndexEndpoint.as_view(),
        name='sentry-api-0-team-member-index'),
    url(r'^teams/(?P<team_id>\d+)/access-groups/$',
        TeamAccessGroupIndexEndpoint.as_view(),
        name='sentry-api-0-team-access-group-index'),
    url(r'^teams/(?P<team_id>\d+)/stats/$',
        TeamStatsEndpoint.as_view(),
        name='sentry-api-0-team-stats'),

    # Projects
    url(r'^projects/$',
        ProjectIndexEndpoint.as_view(),
        name='sentry-api-0-project-index'),
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

    # Groups
    url(r'^groups/(?P<group_id>\d+)/$',
        GroupDetailsEndpoint.as_view(),
        name='sentry-api-0-group-details'),
    url(r'^groups/(?P<group_id>\d+)/assign/$',
        GroupAssignEndpoint.as_view(),
        name='sentry-api-0-group-assign'),
    url(r'^groups/(?P<group_id>\d+)/resolve/$',
        GroupResolveEndpoint.as_view(),
        name='sentry-api-0-group-resolve'),
    url(r'^groups/(?P<group_id>\d+)/bookmark/$',
        GroupBookmarkEndpoint.as_view(),
        name='sentry-api-0-group-bookmark'),
    url(r'^groups/(?P<group_id>\d+)/markseen/$',
        GroupMarkSeenEndpoint.as_view(),
        name='sentry-api-0-group-markseen'),
    url(r'^groups/(?P<group_id>\d+)/delete/$',
        GroupDeleteEndpoint.as_view(),
        name='sentry-api-0-group-delete'),
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
