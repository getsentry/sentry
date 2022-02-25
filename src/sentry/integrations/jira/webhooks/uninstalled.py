from rest_framework.request import Request
from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.integrations.utils import get_integration_from_jwt

from .base import JiraEndpointBase


class JiraUninstalledEndpoint(JiraEndpointBase):
    def post(self, request: Request, *args, **kwargs) -> Response:
        token = self.get_token(request)
        integration = get_integration_from_jwt(
            token=token,
            path=request.path,
            provider=self.provider,
            query_params=request.GET,
            method="POST",
        )
        integration.update(status=ObjectStatus.DISABLED)

        return self.respond()
