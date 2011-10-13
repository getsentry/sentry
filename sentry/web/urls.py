"""
sentry.web.urls
~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import re

from django.conf.urls.defaults import *
from django.views.defaults import page_not_found

from sentry.conf.settings import KEY
from sentry.web import views, feeds, api

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
    url(r'^_static/(?P<path>.*)$', views.static_media, name='sentry-media'),

    # Legacy redirects
    # TODO:

    url(r'^group/(?P<group_id>\d+)$', views.group, name='sentry-group'),
    url(r'^group/(?P<group_id>\d+)/messages$', views.group_message_list, name='sentry-group-messages'),
    url(r'^group/(?P<group_id>\d+)/messages/(?P<message_id>\d+)$', views.group_message_details, name='sentry-group-message'),
    url(r'^group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)', views.group_plugin_action, name='sentry-group-plugin-action'),

    # Feeds

    url(r'^feeds/messages.xml$', feeds.MessageFeed(), name='sentry-feed-messages'),
    url(r'^feeds/summaries.xml$', feeds.SummaryFeed(), name='sentry-feed-summaries'),

    # JS

    url(r'^jsapi/$', views.ajax_handler, name='sentry-ajax'),

    # API

    url(r'^store/$', api.store, name='sentry-store'),

    # Account

    url(r'^login$', views.login, name='sentry-login'),
    url(r'^logout$', views.logout, name='sentry-logout'),

    # Management

    url(r'^projects$', views.project_list, name='sentry-project-list'),
    url(r'^projects/(?P<project_id>\d+)/edit$', views.manage_project, name='sentry-manage-project'),

    # Global

    url(r'^$', views.dashboard, name='sentry'),

    # Project specific

    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)$', views.group, name='sentry-group'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/messages$', views.group_message_list, name='sentry-group-messages'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/messages/(?P<message_id>\d+)$', views.group_message_details, name='sentry-group-message'),
    url(r'^(?P<project_id>\d+)/group/(?P<group_id>\d+)/actions/(?P<slug>[\w_-]+)', views.group_plugin_action, name='sentry-group-plugin-action'),

    url(r'^(?P<project_id>\d+)/search$', views.search, name='sentry-search'),

    url(r'^(?P<project_id>\d+)$', views.index, name='sentry'),

)
