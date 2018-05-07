from __future__ import absolute_import

from django.conf.urls import patterns, url

from .descriptor import BitBucketDescriptorEndpoint


urlpatterns = patterns(
    '',
    url(r'^descriptor/$', BitBucketDescriptorEndpoint.as_view()),
)
