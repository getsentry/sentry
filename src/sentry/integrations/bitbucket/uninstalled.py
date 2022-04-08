from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.utils import AtlassianConnectValidationError, get_integration_from_jwt
from sentry.models import Repository


class BitbucketUninstalledEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, *args, **kwargs) -> Response:
        try:
            token = request.META["HTTP_AUTHORIZATION"].split(" ", 1)[1]
        except (KeyError, IndexError):
            return self.respond(status=400)

        try:
            integration = get_integration_from_jwt(
                token, request.path, "bitbucket", request.GET, method="POST"
            )
        except AtlassianConnectValidationError:
            return self.respond(status=400)

        integration.update(status=ObjectStatus.DISABLED)
        organizations = integration.organizations.all()

        Repository.objects.filter(
            organization_id__in=organizations.values_list("id", flat=True),
            provider="integrations:bitbucket",
            integration_id=integration.id,
        ).update(status=ObjectStatus.DISABLED)

        return self.respond()
