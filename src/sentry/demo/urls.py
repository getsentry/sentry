from django.conf.urls import url

from sentry.conf.urls import urlpatterns as conf_urlpatterns
from sentry.web.frontend.react_page import ReactPageView

from .demo_start import DemoStartView

# add the demo start route at the head of the urls
urlpatterns = [
    url(r"^demo/start/$", DemoStartView.as_view(), name="sentry-demo-start"),
]
# add the rest of our rules
urlpatterns += conf_urlpatterns

# pop off the catch all
catch_all = urlpatterns.pop()
# add our org catch all before the last catch all
urlpatterns += [
    url(
        r"^(?:settings|organizations)/(?P<organization_slug>[\w_-]+)/",
        ReactPageView.as_view(),
        name="sentry-org-catch-all",
    ),
    catch_all,
]
