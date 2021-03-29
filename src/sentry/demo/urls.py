from django.conf.urls import url

from sentry.conf.urls import urlpatterns as conf_urlpatterns
from sentry.web.frontend.demo_start import DemoStartView

urlpatterns = [
    url(r"^demo/start/$", DemoStartView.as_view(), name="sentry-demo-start"),
]
urlpatterns += conf_urlpatterns
