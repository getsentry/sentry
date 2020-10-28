from __future__ import absolute_import


from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.constants import ObjectStatus
from sentry.models import Repository
from sentry.integrations.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_jwt,
)


class BitbucketUninstalledEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(BitbucketUninstalledEndpoint, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
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
