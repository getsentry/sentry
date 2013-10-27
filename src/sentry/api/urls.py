from django.conf.urls import patterns, url

from .endpoints.group_index import GroupListView
from .endpoints.group_details import GroupDetailsView

urlpatterns = patterns(
    '',
    url(r'^(?P<team_slug>[^\/]+)/(?P<project_id>[^\/]+)/groups/$',
        GroupListView.as_view(),
        name='sentry-api-0-group-list'),
    url(r'^(?P<team_slug>[^\/]+)/(?P<project_id>[^\/]+)/groups/(?P<group_id>\d+)/$',
        GroupDetailsView.as_view(),
        name='sentry-api-0-group-details'),
    # url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework'))
)
