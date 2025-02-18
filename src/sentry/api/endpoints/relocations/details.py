import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SuperuserOrStaffFeatureFlaggedPermission
from sentry.api.serializers import serialize
from sentry.models.relocation import Relocation

logger = logging.getLogger(__name__)


@region_silo_endpoint
class RelocationDetailsEndpoint(Endpoint):
    owner = ApiOwner.DEV_INFRA
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def get(self, request: Request, relocation_uuid: str) -> Response:
        """
        Get a single relocation.
        ``````````````````````````````````````````````````

        :pparam string relocation_uuid: a UUID identifying the relocation.

        :auth: required
        """

        logger.info("relocations.details.get.start", extra={"caller": request.user.id})

        try:
            return self.respond(serialize(Relocation.objects.get(uuid=relocation_uuid)))
        except Relocation.DoesNotExist:
            raise ResourceDoesNotExist
