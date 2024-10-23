from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import OrgAuthTokenAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.flags.providers import (
    DeserializationError,
    InvalidProvider,
    handle_provider_event,
    write,
)
from sentry.models.organization import Organization
from sentry.utils.sdk import bind_organization_context

"""HTTP endpoint.

This endpoint accepts only organization authorization tokens. I've made the conscious
decision to exclude all other forms of authentication. We don't want users accidentally
writing logs or leaked DSNs generating invalid log entries. An organization token is
secret and reasonably restricted and so makes sense for this use case where we have
inter-provider communication.

This endpoint allows writes if any write-level "org" permission was provided.
"""


class OrganizationFlagHookPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:ci"],
    }


@region_silo_endpoint
class OrganizationFlagsHooksEndpoint(Endpoint):
    authentication_classes = (OrgAuthTokenAuthentication,)
    owner = ApiOwner.REPLAY
    permission_classes = (OrganizationFlagHookPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str,
        *args,
        **kwargs,
    ):
        try:
            if isinstance(organization_id_or_slug, int):
                organization = Organization.objects.get_from_cache(id=organization_id_or_slug)
            else:
                organization = Organization.objects.get_from_cache(slug=organization_id_or_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, organization)
        bind_organization_context(organization)

        kwargs["organization"] = organization
        return args, kwargs

    def post(self, request: Request, organization: Organization, provider: str) -> Response:
        try:
            write(handle_provider_event(provider, request.data, organization.id))
            return Response(status=200)
        except InvalidProvider:
            raise ResourceDoesNotExist
        except DeserializationError as exc:
            return Response(exc.errors, status=400)
