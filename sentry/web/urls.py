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
from sentry.web import views, feeds

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

    # Feeds

    url(r'^feeds/messages.xml$', feeds.MessageFeed(), name='sentry-feed-messages'),
    url(r'^feeds/summaries.xml$', feeds.SummaryFeed(), name='sentry-feed-summaries'),

    # JS and API

    url(r'^jsapi/$', views.ajax_handler, name='sentry-ajax'),
    url(r'^store/$', views.store, name='sentry-store'),

    # Normal views

    url(r'^login$', views.login, name='sentry-login'),
    url(r'^logout$', views.logout, name='sentry-logout'),
    url(r'^group/(\d+)$', views.group, name='sentry-group'),
    url(r'^group/(\d+)/messages$', views.group_message_list, name='sentry-group-messages'),
    url(r'^group/(\d+)/messages/(\d+)$', views.group_message_details, name='sentry-group-message'),
    url(r'^group/(\d+)/actions/([\w_-]+)', views.group_plugin_action, name='sentry-group-plugin-action'),

    url(r'^search$', views.search, name='sentry-search'),

    url(r'^$', views.index, name='sentry'),
)
