from django.urls import re_path

from .search import GiteaIssueSearchEndpoint
from .webhooks import GiteaWebhookEndpoint

urlpatterns = [
    re_path(
        r"^search/(?P<organization_id_or_slug>[^/]+)/(?P<integration_id>\d+)/$",
        GiteaIssueSearchEndpoint.as_view(),
        name="sentry-extensions-gitea-search",
    ),
    re_path(
        # Both the organization and the integration, so that reconciling our
        # hooks on a repository cannot reach a hook a *different* Sentry
        # organization registered on that same repository - two organizations
        # that installed with the same OAuth app share one `Integration` row,
        # and therefore would otherwise share one hook URL. Bitbucket Server's
        # route has the same shape for the same reason.
        # Both loosely matched and validated in the view, so a malformed id
        # answers 400 rather than falling out of the router as a 404 raised
        # from the request parser's own `resolve()`.
        r"^organizations/(?P<organization_id>[^/]+)/webhook/(?P<integration_id>[^/]+)/$",
        GiteaWebhookEndpoint.as_view(),
        name="sentry-extensions-gitea-webhook",
    ),
]
