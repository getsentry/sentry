"""
sentry.web.urls
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import re

try:
    from django.conf.urls import include, patterns, url
except ImportError:
    # django < 1.5 compat
    from django.conf.urls.defaults import include, patterns, url  # NOQA

from sentry.web import api
from sentry.web.frontend import (alerts, accounts, generic, groups, events,
    projects, admin, docs, teams, users)

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
    url(r'^_static/(?P<module>[^/]+)/(?P<path>.*)$', generic.static_media,
        name='sentry-media'),

    # Account
    url(r'^login/$', accounts.login,
        name='sentry-login'),
    url(r'^login-redirect/$', accounts.login_redirect,
        name='sentry-login-redirect'),
    url(r'^logout/$', accounts.logout,
        name='sentry-logout'),
    url(r'^register/$', accounts.register,
        name='sentry-register'),
    url(r'^account/recover/$', accounts.recover,
        name='sentry-account-recover'),
    url(r'^account/recover/confirm/(?P<user_id>[\d]+)/(?P<hash>[0-9a-zA-Z]+)/$', accounts.recover_confirm,
        name='sentry-account-recover-confirm'),
    url(r'^account/settings/$', accounts.settings,
        name='sentry-account-settings'),
    url(r'^account/settings/appearance/$', accounts.appearance_settings,
        name='sentry-account-settings-appearance'),
    url(r'^account/settings/identities/$', accounts.list_identities,
        name='sentry-account-settings-identities'),
    url(r'^account/settings/notifications/$', accounts.notification_settings,
        name='sentry-account-settings-notifications'),
    url(r'^account/settings/social/', include('social_auth.urls')),

    # Settings - Teams
    url(r'^account/teams/$', teams.team_list,
        name='sentry-team-list'),
    url(r'^account/teams/new/$', teams.create_new_team,
        name='sentry-new-team'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/settings/$', teams.manage_team,
        name='sentry-manage-team'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/remove/$', teams.remove_team,
        name='sentry-remove-team'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/groups/$', teams.manage_access_groups,
        name='sentry-manage-access-groups'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/groups/new/$', teams.new_access_group,
        name='sentry-new-access-group'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/groups/(?P<group_id>\d+)/edit/$', teams.access_group_details,
        name='sentry-edit-access-group'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/groups/(?P<group_id>\d+)/remove/$', teams.remove_access_group,
        name='sentry-remove-access-group'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/groups/(?P<group_id>\d+)/members/$', teams.access_group_members,
        name='sentry-access-group-members'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/groups/(?P<group_id>\d+)/members/(?P<user_id>\d+)/remove/$',
        teams.remove_access_group_member, name='sentry-remove-access-group-member'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/groups/(?P<group_id>\d+)/projects/$', teams.access_group_projects,
        name='sentry-access-group-projects'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/groups/(?P<group_id>\d+)/projects/(?P<project_id>\d+)/remove/$',
        teams.remove_access_group_project, name='sentry-remove-access-group-project'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/members/$', teams.manage_team_members,
        name='sentry-manage-team-members'),
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
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/projects/$', teams.manage_team_projects,
        name='sentry-manage-team-projects'),
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/projects/new/$', teams.create_new_team_project,
        name='sentry-new-team-project'),
    url(r'^accept/(?P<member_id>\d+)/(?P<token>\w+)/$', teams.accept_invite,
        name='sentry-accept-invite'),

    # Settings - Projects
    url(r'^account/teams/(?P<team_slug>[\w_-]+)/projects/new/$', projects.new_project,
        name='sentry-new-project'),

    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/settings/$', projects.manage_project,
        name='sentry-manage-project'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/docs/$', docs.client_help,
        name='sentry-project-client-help'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/docs/(?P<platform>%s)/$' % ('|'.join(re.escape(r) for r in docs.PLATFORM_LIST),),
        docs.client_guide, name='sentry-docs-client'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/keys/$', projects.manage_project_keys,
        name='sentry-manage-project-keys'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/keys/new/$', projects.new_project_key,
        name='sentry-new-project-key'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/keys/(?P<key_id>\d+)/remove/$', projects.remove_project_key,
        name='sentry-remove-project-key'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/$', projects.manage_plugins,
        name='sentry-manage-project-plugins'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/(?P<slug>[\w_-]+)/$', projects.configure_project_plugin,
        name='sentry-configure-project-plugin'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/(?P<slug>[\w_-]+)/reset/$', projects.reset_project_plugin,
        name='sentry-reset-project-plugin'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/(?P<slug>[\w_-]+)/disable/$', projects.disable_project_plugin,
        name='sentry-disable-project-plugin'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/plugins/(?P<slug>[\w_-]+)/enable/$', projects.enable_project_plugin,
        name='sentry-enable-project-plugin'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/remove/$', projects.remove_project,
        name='sentry-remove-project'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/tags/$', projects.manage_project_tags,
        name='sentry-manage-project-tags'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/notifications/$', projects.notification_settings,
        name='sentry-project-notifications'),

    # Generic
    url(r'^$', generic.dashboard,
        name='sentry'),
    url(r'^wall/$', generic.wall_display,
        name='sentry-wall'),

    # Admin
    url(r'^manage/status/$', admin.status_env,
        name='sentry-admin-status'),
    url(r'^manage/status/packages/$', admin.status_packages,
        name='sentry-admin-packages-status'),
    url(r'^manage/status/mail/$', admin.status_mail,
        name='sentry-admin-mail-status'),
    url(r'^manage/stats/$', admin.stats,
        name='sentry-admin-stats'),

    # Admin - Teams
    url(r'^manage/teams/$', admin.manage_teams,
        name='sentry-admin-teams'),

    # Admin - Projects
    url(r'^manage/projects/$', admin.manage_projects,
        name='sentry-admin-projects'),

    # Admin - Users
    url(r'^manage/users/$', admin.manage_users,
        name='sentry-admin-users'),
    url(r'^manage/users/new/$', admin.create_new_user,
        name='sentry-admin-new-user'),
    url(r'^manage/users/(?P<user_id>\d+)/$', admin.edit_user,
        name='sentry-admin-edit-user'),
    url(r'^manage/users/(?P<user_id>\d+)/remove/$', admin.remove_user,
        name='sentry-admin-remove-user'),
    url(r'^manage/users/(?P<user_id>\d+)/projects/$', admin.list_user_projects,
        name='sentry-admin-list-user-projects'),

    # Admin - Plugins
    url(r'^manage/plugins/(?P<slug>[\w_-]+)/$', admin.configure_plugin,
        name='sentry-admin-configure-plugin'),

    # API / JS
    url(r'^crossdomain\.xml$', api.crossdomain_xml_index,
        name='sentry-api-crossdomain-xml-index'),
    url(r'^api/store/$', api.StoreView.as_view(),
        name='sentry-api-store'),

    # Client API endpoints. MUST NOT BE CHANGED
    url(r'^api/(?P<project_id>[\w_-]+)/crossdomain\.xml$', api.crossdomain_xml,
        name='sentry-api-crossdomain-xml'),
    url(r'^api/(?P<project_id>[\w_-]+)/store/$', api.StoreView.as_view(),
        name='sentry-api-store'),

    # Generic API
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/poll/$', api.poll,
        name='sentry-api-poll'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/resolve/$', api.resolve,
        name='sentry-api-resolve'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/bookmark/$', api.bookmark,
        name='sentry-api-bookmark'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/clear/$', api.clear,
        name='sentry-api-clear'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?:(?P<project_id>[\w_-]+)/)?chart/$', api.chart,
        name='sentry-api-chart'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/remove/$', api.remove_group,
        name='sentry-api-remove-group'),

    url(r'^api/(?P<team_slug>[\w_-]+)/(?:(?P<project_id>[\w_-]+)/)?groups/trends/$', api.get_group_trends,
        name='sentry-api-groups-trends'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?:(?P<project_id>[\w_-]+)/)?groups/newest/$', api.get_new_groups,
        name='sentry-api-groups-new'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?:(?P<project_id>[\w_-]+)/)?groups/resolved/$', api.get_resolved_groups,
        name='sentry-api-groups-resolved'),

    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/public/$', api.make_group_public,
        name='sentry-api-set-group-public'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/private/$', api.make_group_private, name='sentry-api-set-group-private'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/resolved/$', api.resolve_group,
        name='sentry-api-set-group-resolve'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/muted/$', api.mute_group,
        name='sentry-api-set-group-mute'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>[\w_-]+)/set/unresolved/$', api.unresolve_group,
        name='sentry-api-set-group-unresolve'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?:(?P<project_id>[\w_-]+)/)?stats/$', api.get_stats,
        name='sentry-api-stats'),
    url(r'^api/(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/tags/search/$', api.search_tags,
        name='sentry-api-search-tags'),
    url(r'^api/(?P<team_slug>[\w_-]+)/users/search/$', api.search_users,
        name='sentry-api-search-users'),
    url(r'^api/(?P<team_slug>[\w_-]+)/projects/search/$', api.search_projects,
        name='sentry-api-search-projects'),

    # Users
    url(r'^(?P<team_slug>[\w_-]+)/users/$', users.user_list,
        name='sentry-users'),
    url(r'^(?P<team_slug>[\w_-]+)/users/(?P<user_id>\d+)/$', users.user_details,
        name='sentry-user-details'),

    # Project specific
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/get-started/$', projects.get_started,
        name='sentry-get-started'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/$', groups.group,
        name='sentry-group'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/$', groups.group_event_list,
        name='sentry-group-events'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/json/$', groups.group_event_list_json,
        name='sentry-group-events-json'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id>\d+)/$', groups.group_event_details,
        name='sentry-group-event'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/events/(?P<event_id_or_latest>(\d+|latest))/json/$', groups.group_event_details_json,
        name='sentry-group-event-json'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)/', groups.group_plugin_action,
        name='sentry-group-plugin-action'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/tags/$', groups.group_tag_list,
        name='sentry-group-tags'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/tags/(?P<tag_name>[^/]+)/$', groups.group_tag_details,
        name='sentry-group-tag-details'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/events/$', events.event_list,
        name='sentry-events'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/events/(?P<event_id>\d+)/replay/$', events.replay_event,
        name='sentry-replay'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/search/$', groups.search,
        name='sentry-search'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/alerts/$', alerts.alert_list,
        name='sentry-project-alerts'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/alerts/(?P<alert_id>\d+)/$', alerts.alert_details,
        name='sentry-project-alert-details'),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/stream/$', groups.group_list),
    url(r'^(?P<team_slug>[\w_-]+)/(?P<project_id>[\w_-]+)/$', groups.group_list,
        name='sentry-stream'),

    url(r'^(?P<team_slug>[\w_-]+)/$', groups.dashboard,
        name='sentry'),

    # Legacy
    url(r'^(?P<project_id>[\w_-]+)/group/(?P<group_id>\d+)/$', groups.redirect_to_group,
        name='sentry-group'),
)
