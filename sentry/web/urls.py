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

    url(r'^group/(?P<group_id>\d+)$', groups.group, name='sentry-group'),
    url(r'^group/(?P<group_id>\d+)/messages$', groups.group_message_list, name='sentry-group-messages'),
    url(r'^group/(?P<group_id>\d+)/messages/(?P<message_id>\d+)$', groups.group_message_details, name='sentry-group-message'),
    url(r'^group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)', groups.group_plugin_action, name='sentry-group-plugin-action'),

    # Feeds

    url(r'^feeds/messages.xml$', feeds.MessageFeed(), name='sentry-feed-messages'),
    url(r'^feeds/summaries.xml$', feeds.SummaryFeed(), name='sentry-feed-summaries'),

    # JS

    url(r'^jsapi/$', groups.ajax_handler, name='sentry-ajax'),

    # API

    url(r'^store/$', api.store, name='sentry-store'),

    # Account

    url(r'^login$', accounts.login, name='sentry-login'),
    url(r'^logout$', accounts.logout, name='sentry-logout'),

    # Management

    url(r'^projects$', projects.project_list, name='sentry-project-list'),
    url(r'^projects/(?P<project_id>\d+)/edit$', projects.manage_project, name='sentry-manage-project'),

    # Global

    url(r'^$', generic.dashboard, name='sentry'),

    # Project specific

    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)$', groups.group, name='sentry-group'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/json$', groups.group_json, name='sentry-group-json'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/events$', groups.group_message_list, name='sentry-group-messages'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/events/(?P<message_id>\d+)$', groups.group_message_details, name='sentry-group-message'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)', groups.group_plugin_action, name='sentry-group-plugin-action'),

    url(r'^(?P<project_id>\d+)/events$', events.event_list, name='sentry'),

    url(r'^(?P<project_id>\d+)/search$', groups.search, name='sentry-search'),

    url(r'^(?P<project_id>\d+)$', groups.group_list, name='sentry'),
)
