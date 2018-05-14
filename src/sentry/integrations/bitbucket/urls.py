from __future__ import absolute_import

from django.conf.urls import patterns, url

from .descriptor import BitbucketDescriptorEndpoint
from .installed import BitbucketInstalledEndpoint

urlpatterns = patterns(
    '',
    url(r'^descriptor/$', BitbucketDescriptorEndpoint.as_view()),
    url(r'^installed/$', BitbucketInstalledEndpoint.as_view()),
)
