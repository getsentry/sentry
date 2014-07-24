from django.conf.urls import patterns, url

from .views.help_index import ApiHelpIndexView


urlpatterns = patterns(
    '',

    url(r'^$', ApiHelpIndexView.as_view(),
        name='sentry-api-0-help'),
)
