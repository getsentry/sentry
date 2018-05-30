from __future__ import absolute_import

from django.conf.urls import patterns, url

from .descriptor import BitbucketDescriptorEndpoint
from .installed import BitbucketInstalledEndpoint
from .webhook import BitbucketWebhookEndpoint
urlpatterns = patterns(
    '',
    url(r'^descriptor/$', BitbucketDescriptorEndpoint.as_view()),
    url(r'^installed/$', BitbucketInstalledEndpoint.as_view()),
    url(r'^organizations/(?P<organization_id>[^\/]+)/webhook/$',
        BitbucketWebhookEndpoint.as_view()),
)
