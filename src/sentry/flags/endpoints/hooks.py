from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.flags.providers import (
    DeserializationError,
    InvalidProvider,
    handle_provider_event,
    write,
)
from sentry.models.orgauthtoken import OrgAuthToken

"""HTTP endpoint.

This endpoint accepts only organization authorization tokens. I've made the conscious
decision to exclude all other forms of authentication. We don't want users accidentally
writing logs or leaked DSNs generating invalid log entries. An organization token is
secret and reasonably restricted and so makes sense for this use case where we have
inter-provider communication.

This endpoint allows writes if any write-level "org" permission was provided.
"""


@region_silo_endpoint
class OrganizationFlagsHooksEndpoint(Endpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, provider: str, token: OrgAuthToken) -> Response:
        try:
            write(handle_provider_event(provider, request.data, token.organization_id))
            return Response(status=200)
        except InvalidProvider:
            raise ResourceDoesNotExist
        except DeserializationError as exc:
            return Response(exc.errors, status=400)
