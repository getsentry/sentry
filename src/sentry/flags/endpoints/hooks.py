from typing import Any

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.flags.providers import DeserializationError, StatsigProvider, get_provider, write
from sentry.utils import metrics

# Organization id used for signature validation when the organization does not
# exist. No signing secrets are stored against it, so validation always fails
# and the request gets the same 401 a real organization with a bad signature
# would. See ``OrganizationFlagsHooksEndpoint.convert_args``.
_NONEXISTENT_ORG_ID = 0


@cell_silo_endpoint
class OrganizationFlagsHooksEndpoint(OrganizationEndpoint):
    authentication_classes = ()
    owner = ApiOwner.REPLAY
    permission_classes = ()
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def convert_args(
        self, request: Request, *args: Any, organization_id_or_slug: str, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        # These webhooks are unauthenticated and authorize each request by validating a
        # provider signature. Resolve the organization to an id here — falling back to one
        # with no signing secrets when it doesn't exist — so ``post`` can validate the
        # signature before any difference between a known and unknown organization is
        # observable. A bad signature then returns 401 either way.
        try:
            args, kwargs = super().convert_args(
                request, *args, organization_id_or_slug=organization_id_or_slug, **kwargs
            )
            kwargs["organization_id"] = kwargs.pop("organization").id
        except ResourceDoesNotExist:
            kwargs["organization_id"] = _NONEXISTENT_ORG_ID
        return (args, kwargs)

    def post(self, request: Request, organization_id: int, provider: str) -> Response:
        try:
            if provider == "statsig":
                return handle_statsig_webhook(request, organization_id)

            provider_cls = get_provider(organization_id, provider, request.headers)
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


def handle_statsig_webhook(request: Request, organization_id: int) -> Response:
    """Statsig webhook handler."""
    event = request.data

    # Statsig sends unauthorized endpoint verification requests. If we receive the request we
    # should echo back the verification code. All subsequent requests must be authorized.
    # This echo never reads the organization, so it behaves the same whether or not the
    # organization exists.
    event_data = event.get("data") if isinstance(event, dict) else None
    if isinstance(event_data, dict) and event_data.get("event") == "url_verification":
        return Response({"verification_code": event_data.get("verification_code")}, status=200)

    provider = StatsigProvider(
        organization_id,
        signature=request.headers.get("X-Statsig-Signature"),
        request_timestamp=request.headers.get("X-Statsig-Request-Timestamp"),
    )
    if not provider.validate(request.body):
        return Response("Not authorized.", status=401)

    write(provider.handle(event))
    metrics.incr("feature_flags.audit_log_event_posted", tags={"provider": "statsig"})
    return Response(status=200)
