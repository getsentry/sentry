import os
import re

from django.conf.urls.defaults import *

from sentry.conf.settings import KEY
from sentry.web import views, feeds

urlpatterns = patterns('',
    url(r'^_static/(?P<path>.*)$', views.static_media, name='sentry-media'),

    # Feeds

    url(r'^feeds/%s/messages.xml$' % re.escape(KEY), feeds.MessageFeed(), name='sentry-feed-messages'),
    url(r'^feeds/%s/summaries.xml$' % re.escape(KEY), feeds.SummaryFeed(), name='sentry-feed-summaries'),

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
