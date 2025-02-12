from django.http import HttpRequest

from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse


def vercel_configure_view(
    request: HttpRequest, org: RpcOrganization, auth_provider: RpcAuthProvider
) -> DeferredResponse:
    return DeferredResponse("sentry_auth_vercel/configure.html")
