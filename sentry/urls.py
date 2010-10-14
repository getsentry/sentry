import os
import re

from django.conf.urls.defaults import *

from sentry.conf import KEY
from sentry import views
from sentry.feeds import MessageFeed, SummaryFeed

SENTRY_ROOT = os.path.dirname(__file__) 

urlpatterns = patterns('',
    url(r'^_media/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': os.path.join(SENTRY_ROOT, 'media')}, name='sentry-media'),

    # Feeds

    url(r'^feeds/%s/messages.xml$' % re.escape(KEY), MessageFeed(), name='sentry-feed-messages'),
    url(r'^feeds/%s/summaries.xml$' % re.escape(KEY), SummaryFeed(), name='sentry-feed-summaries'),

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

    url(r'^$', views.index, name='sentry'),
)
