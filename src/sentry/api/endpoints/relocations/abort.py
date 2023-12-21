import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.models.relocation import Relocation

ERR_NOT_ABORTABLE_STATUS = (
    "Relocations can only be cancelled if they are not yet complete; this relocation is `SUCCESS`."
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class RelocationAbortEndpoint(Endpoint):
    owner = ApiOwner.RELOCATION
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SuperuserPermission,)

    def put(self, request: Request, relocation_uuid: str) -> Response:
        """
        Immediately aborts an in-progress relocation.
        ``````````````````````````````````````````````````

        This operation differs from the superficially similar `/cancel/` endpoint in that it does
        not attempt to do an orderly teardown, and instead fails the relocation immediately. An
        abrupt shutdown like this could leave data in an unpredictable state, so unless you have a
        very good reason, you should prefer `/cancel/` to `/abort/`, and only use the latter when
        the former fails.

        :pparam string relocation_uuid: a UUID identifying the relocation.

        :auth: required
        """

        logger.info("relocations.abort.put.start", extra={"caller": request.user.id})

        try:
            relocation: Relocation = Relocation.objects.get(uuid=relocation_uuid)
        except Relocation.DoesNotExist:
            raise ResourceDoesNotExist

        if relocation.status in {Relocation.Status.FAILURE.value, Relocation.Status.SUCCESS.value}:
            return Response(
                {"detail": ERR_NOT_ABORTABLE_STATUS},
                status=400,
            )

        relocation.status = Relocation.Status.FAILURE.value
        relocation.failure_reason = "This relocation was aborted by an administrator."
        relocation.save()

        return self.respond(serialize(relocation))
