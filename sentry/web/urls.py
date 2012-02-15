"""
sentry.web.urls
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf.urls.defaults import *

from sentry.web import api
from sentry.web.frontend import accounts, generic, groups, events, \
  projects, admin

__all__ = ('urlpatterns',)


def init_plugins():
    from django.db.models import get_apps, get_models
    for app in get_apps():
        try:
            get_models(app)
        except:
            continue
init_plugins()

urlpatterns = patterns('',
    url(r'^_static/(?P<path>.*)$', generic.static_media, name='sentry-media'),

    # Legacy API
    url(r'^store/$', api.store),

    # Legacy redirects

    url(r'^group/(?P<group_id>\d+)$', groups.group),
    url(r'^group/(?P<group_id>\d+)/messages$', groups.group_event_list),
    url(r'^group/(?P<group_id>\d+)/messages/(?P<event_id>\d+)$', groups.group_event_details),
    url(r'^group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)$', groups.group_plugin_action),

    # Account

    url(r'^login/$', accounts.login, name='sentry-login'),
    url(r'^logout/$', accounts.logout, name='sentry-logout'),
    url(r'^account/settings/$', accounts.settings, name='sentry-account-settings'),

    # Management

    url(r'^projects/$', projects.project_list, name='sentry-project-list'),
    url(r'^projects/new/$', projects.new_project, name='sentry-new-project'),
    url(r'^projects/(?P<project_id>\d+)/edit/$', projects.manage_project, name='sentry-manage-project'),
    url(r'^projects/(?P<project_id>\d+)/plugins/(?P<slug>[\w_-]+)/$', projects.configure_project_plugin, name='sentry-configure-project-plugin'),
    url(r'^projects/(?P<project_id>\d+)/remove/$', projects.remove_project, name='sentry-remove-project'),
    url(r'^projects/(?P<project_id>\d+)/members/new/$', projects.new_project_member, name='sentry-new-project-member'),
    url(r'^projects/(?P<project_id>\d+)/members/(?P<member_id>\d+)/edit/$', projects.edit_project_member, name='sentry-edit-project-member'),
    url(r'^projects/(?P<project_id>\d+)/members/(?P<member_id>\d+)/remove/$', projects.remove_project_member, name='sentry-remove-project-member'),

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
    url(r'^api/(?P<project_id>\d+)/poll/$', api.poll, name='sentry-api-poll'),
    url(r'^api/(?P<project_id>\d+)/resolve/$', api.resolve, name='sentry-api-resolve'),
    url(r'^api/(?P<project_id>\d+)/bookmark/$', api.bookmark, name='sentry-api-bookmark'),
    url(r'^api/(?P<project_id>\d+)/clear/$', api.clear, name='sentry-api-clear'),
    url(r'^api/(?P<project_id>\d+)/chart/$', api.chart, name='sentry-api-chart'),

    # Project specific

    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/$', groups.group, name='sentry-group'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/json/$', groups.group_json, name='sentry-group-json'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/events/$', groups.group_event_list, name='sentry-group-events'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/events/(?P<event_id>\d+)/$', groups.group_event_details, name='sentry-group-event'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)/', groups.group_plugin_action, name='sentry-group-plugin-action'),

    url(r'^(?P<project_id>\d+)/events/$', events.event_list, name='sentry-events'),
    url(r'^(?P<project_id>\d+)/events/(?P<event_id>\d+)/replay/$', events.replay_event, name='sentry-replay'),

    url(r'^(?P<project_id>\d+)/search/$', groups.search, name='sentry-search'),

    url(r'^(?P<project_id>\d+)/view/(?P<view_id>\d+)/$', groups.group_list, name='sentry'),
    url(r'^(?P<project_id>\d+)/$', groups.group_list, name='sentry'),
)
