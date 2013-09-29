from django.conf.urls import patterns, url

from .endpoints.event_index import EventListView
from .endpoints.event_details import EventDetailsView
from .endpoints.event_resolve import ResolveEventView

urlpatterns = patterns(
    '',
    url(r'^(?P<team_slug>[^\/]+)/(?P<project_id>[^\/]+)/events/$',
        EventListView.as_view(),
        name='sentry-api-1-event-list'),
    url(r'^(?P<team_slug>[^\/]+)/(?P<project_id>[^\/]+)/events/(?P<group_id>\d+)/$',
        EventDetailsView.as_view(),
        name='sentry-api-1-event-details'),
    url(r'^(?P<team_slug>[^\/]+)/(?P<project_id>[^\/]+)/events/(?P<group_id>\d+)/resolve/$',
        ResolveEventView.as_view(),
        name='sentry-api-1-resolve-event'),
    # url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework'))
)
