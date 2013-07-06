from django.conf.urls import patterns, url, include

from . import views

urlpatterns = patterns('',
    url(r'^(?P<team_slug>[^\/]+)/(?P<project_id>[^\/]+)/stream/$', views.StreamView.as_view()),
    # url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework'))
)
