from __future__ import absolute_import

from django.conf.urls import patterns, url

from .views.help_index import ApiHelpIndexView
from .views.help_section import ApiHelpSectionView


urlpatterns = patterns(
    '',

    url(r'^$', ApiHelpIndexView.as_view(),
        name='sentry-api-0-help'),
    url(r'^(?P<section_id>[^/]+)/$', ApiHelpSectionView.as_view(),
        name='sentry-api-0-help-section'),
)
