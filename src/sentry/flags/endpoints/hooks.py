import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.flags.providers import DeserializationError, get_provider, write
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationFlagsHooksEndpoint(OrganizationEndpoint):
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
            provider_cls = get_provider(organization.id, provider, request.headers)
            if provider_cls is None:
                raise ResourceDoesNotExist
            elif not provider_cls.validate(request.body):
                return Response("Not authorized.", status=401)
            else:
                write(provider_cls.handle(request.data))
                return Response(status=200)
        except DeserializationError as exc:
            sentry_sdk.capture_exception()
            return Response(exc.errors, status=200)
