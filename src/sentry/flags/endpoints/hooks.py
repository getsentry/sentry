import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.flags.endpoints import OrganizationFlagsEndpoint
from sentry.flags.providers import (
    DeserializationError,
    InvalidProvider,
    handle_provider_event,
    validate_provider_event,
    write,
)
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationFlagsHooksEndpoint(OrganizationFlagsEndpoint):
    authentication_classes = ()
    owner = ApiOwner.REPLAY
    permission_classes = ()
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization, provider: str) -> Response:
        if not features.has(
            "organizations:feature-flag-audit-log", organization, actor=request.user
        ):
            return Response("Not enabled.", status=404)

        try:
            if not validate_provider_event(
                provider,
                request.body,
                request.headers,
                organization.id,
            ):
                return Response("Not authorized.", status=401)

            write(handle_provider_event(provider, request.data, organization.id))
            return Response(status=200)
        except InvalidProvider:
            raise ResourceDoesNotExist
        except DeserializationError as exc:
            sentry_sdk.capture_exception()
            return Response(exc.errors, status=200)
