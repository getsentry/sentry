"""
sentry.web.urls
~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf.urls.defaults import *
from django.views.defaults import page_not_found

from sentry.web import feeds, api
from sentry.web.frontend import accounts, generic, groups, events, projects

handler404 = lambda x: page_not_found(x, template_name='sentry/404.html')


def handler500(request):
    """
    500 error handler.

    Templates: `500.html`
    Context: None
    """
    from django.template import Context, loader
    from django.http import HttpResponseServerError

    context = {'request': request}

    t = loader.get_template('sentry/500.html')
    return HttpResponseServerError(t.render(Context(context)))

urlpatterns = patterns('',
    url(r'^_static/(?P<path>.*)$', generic.static_media, name='sentry-media'),

    # Legacy redirects
    # TODO:

    url(r'^feeds/messages.xml$', feeds.MessageFeed(), name='sentry-feed-messages'),
    url(r'^feeds/summaries.xml$', feeds.SummaryFeed(), name='sentry-feed-summaries'),
    url(r'^group/(?P<group_id>\d+)$', groups.group, name='sentry-group'),
    url(r'^group/(?P<group_id>\d+)/messages$', groups.group_event_list, name='sentry-group-events'),
    url(r'^group/(?P<group_id>\d+)/messages/(?P<event_id>\d+)$', groups.group_event_details, name='sentry-group-event'),
    url(r'^group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)', groups.group_plugin_action, name='sentry-group-plugin-action'),

    # Feeds

    url(r'^feeds/events.xml$', feeds.MessageFeed(), name='sentry-feed-events'),
    url(r'^feeds/groups.xml$', feeds.SummaryFeed(), name='sentry-feed-groups'),

    # API

    url(r'^store/$', api.store, name='sentry-store'),

    # Account

    url(r'^login$', accounts.login, name='sentry-login'),
    url(r'^logout$', accounts.logout, name='sentry-logout'),

    # Management

    url(r'^projects$', projects.project_list, name='sentry-project-list'),
    url(r'^projects/new$', projects.new_project, name='sentry-new-project'),
    url(r'^projects/(?P<project_id>\d+)/edit$', projects.manage_project, name='sentry-manage-project'),
    url(r'^projects/(?P<project_id>\d+)/remove$', projects.remove_project, name='sentry-remove-project'),
    url(r'^projects/(?P<project_id>\d+)/members/new$', projects.new_project_member, name='sentry-new-project-member'),
    url(r'^projects/(?P<project_id>\d+)/members/(?P<member_id>\d+)/edit$', projects.edit_project_member, name='sentry-edit-project-member'),
    url(r'^projects/(?P<project_id>\d+)/members/(?P<member_id>\d+)/remove$', projects.remove_project_member, name='sentry-remove-project-member'),

    # Global

    url(r'^$', generic.dashboard, name='sentry'),
    url(r'^status$', generic.status, name='sentry-status'),

    # JS

    url(r'^(?P<project_id>\d+)/jsapi$', groups.ajax_handler, name='sentry-ajax'),

    # Project specific

    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)$', groups.group, name='sentry-group'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/json$', groups.group_json, name='sentry-group-json'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/events$', groups.group_event_list, name='sentry-group-events'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/events/(?P<event_id>\d+)$', groups.group_event_details, name='sentry-group-event'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)', groups.group_plugin_action, name='sentry-group-plugin-action'),

    url(r'^(?P<project_id>\d+)/events$', events.event_list, name='sentry-events'),
    url(r'^(?P<project_id>\d+)/events/(?P<event_id>\d+)/replay$', events.replay_event, name='sentry-replay'),

    url(r'^(?P<project_id>\d+)/search$', groups.search, name='sentry-search'),

    url(r'^(?P<project_id>\d+)/view/(?P<view_id>\d+)$', groups.group_list, name='sentry'),
    url(r'^(?P<project_id>\d+)$', groups.group_list, name='sentry'),
)
