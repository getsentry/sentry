from typing import int
import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.flags.providers import DeserializationError, StatsigProvider, get_provider, write
from sentry.models.organization import Organization
from sentry.utils import metrics


@region_silo_endpoint
class OrganizationFlagsHooksEndpoint(OrganizationEndpoint):
    authentication_classes = ()
    owner = ApiOwner.REPLAY
    permission_classes = ()
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization, provider: str) -> Response:
        try:
            if provider == "statsig":
                return handle_statsig_webhook(request, organization)

            provider_cls = get_provider(organization.id, provider, request.headers)
            if provider_cls is None:
                raise ResourceDoesNotExist
            elif not provider_cls.validate(request.body):
                return Response("Not authorized.", status=401)
            else:
                write(provider_cls.handle(request.data))
                metrics.incr("feature_flags.audit_log_event_posted", tags={"provider": provider})
                return Response(status=200)
        except DeserializationError as exc:
            sentry_sdk.capture_exception()
            return Response(exc.errors, status=200)


def handle_statsig_webhook(request: Request, organization: Organization) -> Response:
    """Statsig webhook handler."""
    event = request.data

    # Statsig sends unauthorized endpoint verification requests. If we receive the request we
    # should echo back the verification code. All subsequent requests must be authorized.
    event_data = event["data"]
    if isinstance(event_data, dict) and event_data.get("event") == "url_verification":
        return Response({"verification_code": event_data["verification_code"]}, status=200)

    provider = StatsigProvider(
        organization.id,
        signature=request.headers.get("X-Statsig-Signature"),
        request_timestamp=request.headers.get("X-Statsig-Request-Timestamp"),
    )
    if not provider.validate(request.body):
        return Response("Not authorized.", status=401)

    write(provider.handle(event))
    metrics.incr("feature_flags.audit_log_event_posted", tags={"provider": "statsig"})
    return Response(status=200)
