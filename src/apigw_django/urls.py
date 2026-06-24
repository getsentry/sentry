from django.urls import re_path

from apigw_django import views

urlpatterns = [
    re_path(r"^_health/$", views.health_check),
    re_path(r"^", views.proxy_view),  # catch-all
]
