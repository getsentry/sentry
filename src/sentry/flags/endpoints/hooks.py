import logging
from urllib.parse import unquote

import sentry_sdk
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
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
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.silo.base import SiloMode
from sentry.utils.security.orgauthtoken_token import hash_token

"""HTTP endpoint.

This endpoint accepts only organization authorization tokens. I've made the conscious
decision to exclude all other forms of authentication. We don't want users accidentally
writing logs or leaked DSNs generating invalid log entries. An organization token is
secret and reasonably restricted and so makes sense for this use case where we have
inter-provider communication.
"""

logger = logging.getLogger()


@region_silo_endpoint
class OrganizationFlagsHooksEndpoint(Endpoint):
    authentication_classes = ()
    owner = ApiOwner.REPLAY
    permission_classes = ()
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str,
        token: str,
        *args,
        **kwargs,
    ):
        try:
            if str(organization_id_or_slug).isdigit():
                organization = Organization.objects.get_from_cache(id=organization_id_or_slug)
            else:
                organization = Organization.objects.get_from_cache(slug=organization_id_or_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        if not is_valid_token(organization.id, token):
            raise AuthenticationFailed("Invalid token specified.")

        kwargs["organization"] = organization
        return args, kwargs

    def post(self, request: Request, organization: Organization, provider: str) -> Response:
        if not features.has(
            "organizations:feature-flag-audit-log", organization, actor=request.user
        ):
            return Response("Not enabled.", status=404)

        try:
            write(handle_provider_event(provider, request.data, organization.id))
            return Response(status=200)
        except InvalidProvider:
            raise ResourceDoesNotExist
        except DeserializationError as exc:
            sentry_sdk.capture_exception()
            return Response(exc.errors, status=200)


def is_valid_token(organization_id: int, token: str) -> bool:
    token_hashed = hash_token(unquote(token))

    if SiloMode.get_current_mode() == SiloMode.REGION:
        try:
            OrgAuthTokenReplica.objects.get(
                token_hashed=token_hashed,
                date_deactivated__isnull=True,
                organization_id=organization_id,
            )
            return True
        except OrgAuthTokenReplica.DoesNotExist:
            return False
    else:
        try:
            OrgAuthToken.objects.get(
                token_hashed=token_hashed,
                date_deactivated__isnull=True,
                organization_id=organization_id,
            )
            return True
        except OrgAuthToken.DoesNotExist:
            return False
