"""
sentry.web.urls
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import re

from django.conf.urls.defaults import include, patterns, url

from sentry.web import api
from sentry.web.frontend import accounts, generic, groups, events, \
  projects, admin, docs, teams

__all__ = ('urlpatterns',)


def init_all_applications():
    """
    Forces import of all applications to ensure code is registered.
    """
    from django.db.models import get_apps, get_models

    for app in get_apps():
        try:
            get_models(app)
        except Exception:
            continue

init_all_applications()

urlpatterns = patterns('',
    url(r'^_static/(?P<module>[^/]+)/(?P<path>.*)$', generic.static_media, name='sentry-media'),

    # Legacy API
    url(r'^store/$', api.store),

    # Legacy redirects

    url(r'^group/(?P<group_id>\d+)$', groups.group),
    url(r'^group/(?P<group_id>\d+)/messages$', groups.group_event_list),
    url(r'^group/(?P<group_id>\d+)/messages/(?P<event_id>\d+)$', groups.group_event_details),
    url(r'^group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)$', groups.group_plugin_action),

    # Account

    url(r'^login/$', accounts.login, name='sentry-login'),
    url(r'^login-redirect/$', accounts.login_redirect, name='sentry-login-redirect'),
    url(r'^logout/$', accounts.logout, name='sentry-logout'),
    url(r'^account/settings/$', accounts.settings, name='sentry-account-settings'),
    url(r'^account/settings/notifications/$', accounts.notification_settings, name='sentry-account-settings-notifications'),
    url(r'^account/settings/identities/$', accounts.list_identities, name='sentry-account-settings-identities'),

    # Teams

    url(r'^account/teams/$', teams.team_list, name='sentry-team-list'),
    url(r'^account/teams/new/$', teams.create_new_team, name='sentry-new-team'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/edit/$', teams.manage_team,
        name='sentry-manage-team'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/remove/$', teams.remove_team,
        name='sentry-remove-team'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/members/new/$', teams.new_team_member,
        name='sentry-new-team-member'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/members/(?P<member_id>\d+)/edit/$', teams.edit_team_member,
        name='sentry-edit-team-member'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/members/(?P<member_id>\d+)/remove/$', teams.remove_team_member,
        name='sentry-remove-team-member'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/members/(?P<member_id>\d+)/suspend/$', teams.suspend_team_member,
        name='sentry-suspend-team-member'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/members/(?P<member_id>\d+)/restore/$', teams.restore_team_member,
        name='sentry-restore-team-member'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/members/pending/(?P<member_id>\d+)/remove/$', teams.remove_pending_team_member,
        name='sentry-remove-pending-team-member'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/members/pending/(?P<member_id>\d+)/reinvite/$', teams.reinvite_pending_team_member,
        name='sentry-reinvite-pending-team-member'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/projects/new/$', teams.create_new_team_project, name='sentry-new-team-project'),
    url(r'^accept/(?P<member_id>\d+)/(?P<token>\w+)/$', teams.accept_invite,
        name='sentry-accept-invite'),

    # Projects

    url(r'^account/projects/$', projects.project_list, name='sentry-project-list'),
    url(r'^account/projects/new/$', projects.new_project, name='sentry-new-project'),
    url(r'^account/projects/(?P<project_id>[\w_-]+)/edit/$', projects.manage_project,
        name='sentry-manage-project'),
    url(r'^account/projects/(?P<project_id>[\w_-]+)/tags/$', projects.manage_project_tags,
        name='sentry-manage-project-tags'),
    url(r'^account/projects/(?P<project_id>[\w_-]+)/docs/$', projects.client_help,
        name='sentry-project-client-help'),
    url(r'^account/projects/(?P<project_id>[\w_-]+)/docs/(?P<platform>%s)/$' % ('|'.join(re.escape(r) for r in docs.PLATFORM_LIST),),
        docs.client_guide, name='sentry-docs-client'),
    url(r'^account/projects/(?P<project_id>[\w_-]+)/plugins/$', projects.manage_plugins,
        name='sentry-manage-project-plugins'),
    url(r'^account/projects/(?P<project_id>[\w_-]+)/plugins/(?P<slug>[\w_-]+)/$', projects.configure_project_plugin,
        name='sentry-configure-project-plugin'),
    url(r'^account/projects/(?P<project_id>[\w_-]+)/remove/$', projects.remove_project,
        name='sentry-remove-project'),

    # Global

    url(r'^$', generic.dashboard, name='sentry'),
    url(r'^manage/status/$', admin.status_env, name='sentry-admin-status'),
    url(r'^manage/status/packages/$', admin.status_packages, name='sentry-admin-packages-status'),
    url(r'^manage/status/queue/$', admin.status_queue, name='sentry-admin-queue-status'),
    url(r'^manage/stats/$', admin.stats, name='sentry-admin-stats'),

    # Admin - Projects
    url(r'^manage/projects/$', admin.manage_projects, name='sentry-admin-projects'),

    # Admin - Users
    url(r'^manage/users/$', admin.manage_users, name='sentry-admin-users'),
    url(r'^manage/users/new/$', admin.create_new_user, name='sentry-admin-new-user'),
    url(r'^manage/users/(?P<user_id>\d+)/$', admin.edit_user, name='sentry-admin-edit-user'),
    url(r'^manage/users/(?P<user_id>\d+)/remove/$', admin.remove_user, name='sentry-admin-remove-user'),
    url(r'^manage/users/(?P<user_id>\d+)/projects/$', admin.list_user_projects, name='sentry-admin-list-user-projects'),

    # Admin - Plugins
    url(r'^manage/plugins/(?P<slug>[\w_-]+)/$', admin.configure_plugin, name='sentry-admin-configure-plugin'),

    # API / JS

    url(r'^api/store/$', api.store, name='sentry-api-store'),
    url(r'^api/notification/$', api.notification, name='sentry-api-notification'),
    url(r'^api/(?P<project_id>[\w_-]+)/store/$', api.store, name='sentry-api-store'),
    url(r'^api/(?P<project_id>[\w_-]+)/poll/$', api.poll, name='sentry-api-poll'),
    url(r'^api/(?P<project_id>[\w_-]+)/resolve/$', api.resolve, name='sentry-api-resolve'),
    url(r'^api/(?P<project_id>[\w_-]+)/bookmark/$', api.bookmark, name='sentry-api-bookmark'),
    url(r'^api/(?P<project_id>[\w_-]+)/clear/$', api.clear, name='sentry-api-clear'),
    url(r'^api/(?:(?P<project_id>[\w_-]+)/)?chart/$', api.chart, name='sentry-api-chart'),
    url(r'^api/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/remove/$', api.remove_group, name='sentry-api-remove-group'),
    url(r'^api/(?:(?P<project_id>[\w_-]+)/)?groups/trends/$', api.get_group_trends, name='sentry-api-groups-trends'),
    url(r'^api/(?:(?P<project_id>[\w_-]+)/)?groups/newest/$', api.get_new_groups, name='sentry-api-groups-new'),
    url(r'^api/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/public/$', api.make_group_public, name='sentry-api-set-group-public'),
    url(r'^api/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/private/$', api.make_group_private, name='sentry-api-set-group-private'),

    # Project specific

    url(r'^(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/$', groups.group, name='sentry-group'),
    url(r'^(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/$', groups.group_event_list, name='sentry-group-events'),
    url(r'^(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/json/$', groups.group_event_list_json, name='sentry-group-events-json'),
    url(r'^(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id>\d+)/$', groups.group_event_details, name='sentry-group-event'),
    url(r'^(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id_or_latest>(\d+|latest))/json/$', groups.group_event_details_json, name='sentry-group-event-json'),
    url(r'^(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)/', groups.group_plugin_action, name='sentry-group-plugin-action'),

    url(r'^(?P<project_id>[\w_-]+)/events/$', events.event_list, name='sentry-events'),
    url(r'^(?P<project_id>[\w_-]+)/events/(?P<event_id>\d+)/replay/$', events.replay_event, name='sentry-replay'),

    url(r'^(?P<project_id>[\w_-]+)/search/$', groups.search, name='sentry-search'),

    url(r'^(?P<project_id>[\w_-]+)/view/(?P<view_id>\d+)/$', groups.group_list, name='sentry'),
    url(r'^(?P<project_id>[\w_-]+)/$', groups.group_list, name='sentry'),

    url(r'', include('social_auth.urls')),
)
