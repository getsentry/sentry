from urllib.parse import unquote

from rest_framework.exceptions import AuthenticationFailed
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
from sentry.hybridcloud.models.orgauthtokenreplica import OrgAuthTokenReplica
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.silo.base import SiloMode
from sentry.utils.security.orgauthtoken_token import hash_token

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
    authentication_classes = ()
    owner = ApiOwner.REPLAY
    permission_classes = ()
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, provider: str, token: str) -> Response:
        token_hashed = hash_token(unquote(token))
        org_token: OrgAuthTokenReplica | OrgAuthToken
        if SiloMode.get_current_mode() == SiloMode.REGION:
            try:
                org_token = OrgAuthTokenReplica.objects.get(
                    token_hashed=token_hashed,
                )
            except OrgAuthTokenReplica.DoesNotExist:
                raise AuthenticationFailed("Invalid org token")
        else:
            try:
                org_token = OrgAuthToken.objects.get(token_hashed=token_hashed)
            except OrgAuthToken.DoesNotExist:
                raise AuthenticationFailed("Invalid org token")

        try:
            write(handle_provider_event(provider, request.data, org_token.organization_id))
            return Response(status=200)
        except InvalidProvider:
            raise ResourceDoesNotExist
        except DeserializationError as exc:
            return Response(exc.errors, status=400)
