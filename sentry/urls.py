import os

from django.conf import settings
from django.conf.urls.defaults import *

from sentry.settings import KEY
from sentry.feeds import MessageFeed, SummaryFeed
from sentry import views

SENTRY_ROOT = os.path.dirname(__file__) 

urlpatterns = patterns('',
    url(r'^_media/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': os.path.join(SENTRY_ROOT, 'media')}, name='sentry-media'),

    # Feeds

    url(r'^feeds/%s/messages.xml$' % KEY, MessageFeed(), name='sentry-feed-messages'),
    url(r'^feeds/%s/summaries.xml$' % KEY, SummaryFeed(), name='sentry-feed-summaries'),

    # JS and API

    url(r'^jsapi/$', views.ajax_handler, name='sentry-ajax'),
    url(r'^store/$', views.store, name='sentry-store'),
    
    # Normal views

    url(r'^login$', views.login, name='sentry-login'),
    url(r'^group/(\d+)$', views.group, name='sentry-group'),

    url(r'^$', views.index, name='sentry'),
)
