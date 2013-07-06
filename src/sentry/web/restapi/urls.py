from django.conf.urls import patterns, url, include

from . import views

urlpatterns = patterns('',
    url(r'^(?P<team_slug>[^\/]+)/(?P<project_id>[^\/]+)/events/$', views.EventListView.as_view(),
    	name='sentry-api-1-event-list'),
    url(r'^(?P<team_slug>[^\/]+)/(?P<project_id>[^\/]+)/events/(?P<group_id>\d+)/$', views.EventDetailsView.as_view(),
    	name='sentry-api-1-event-details'),
    url(r'^(?P<team_slug>[^\/]+)/(?P<project_id>[^\/]+)/events/(?P<group_id>\d+)/resolve/$', views.ResolveEventView.as_view(),
    	name='sentry-api-1-resolve-event'),
    # url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework'))
)
