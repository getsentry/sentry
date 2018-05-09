from __future__ import absolute_import

from django.conf.urls import patterns, url

from .descriptor import BitbucketDescriptorEndpoint
from .installed import BitbucketInstalledEndpoint
from .uninstalled import BitbucketUninstalledEndpoint

urlpatterns = patterns(
    '',
    url(r'^descriptor/$', BitbucketDescriptorEndpoint.as_view()),
    url(r'^installed/$', BitbucketInstalledEndpoint.as_view()),
    url(r'^uninstalled/$', BitbucketUninstalledEndpoint.as_view()),
)
