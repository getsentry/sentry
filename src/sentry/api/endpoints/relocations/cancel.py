import logging
from string import Template

from django.db import DatabaseError
from django.db.models import F
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.endpoints.relocations import ERR_UNKNOWN_RELOCATION_STEP
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.models.relocation import Relocation

ERR_NOT_CANCELLABLE_STATUS = (
    "Relocations can only be cancelled if they are not yet complete; this relocation is `SUCCESS`."
)
ERR_COULD_NOT_CANCEL_RELOCATION = (
    "Could not cancel relocation, perhaps because it has already completed."
)
ERR_COULD_NOT_CANCEL_RELOCATION_AT_STEP = Template(
    """Could not cancel relocation at step `$step`; this is likely because this step has already
    started."""
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class RelocationCancelEndpoint(Endpoint):
    owner = ApiOwner.RELOCATION
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SuperuserPermission,)

    def put(self, request: Request, relocation_uuid: str) -> Response:
        """
        Cancel an in-progress relocation.
        ``````````````````````````````````````````````````

        This operation differs from the superficially similar `/abort/` endpoint in that it does an orderly cancellation, making sure to complete currently active relocation step before stopping. Conversely, the `/abort/` endpoint merely stops work as quickly as possible.

        This command accepts a single optional parameter, which specifies the step BEFORE which the
        cancellation should occur. If no such parameter is specified, the cancellation is scheduled
        for the step immediately following the currently active one, if possible.

        :pparam string relocation_uuid: a UUID identifying the relocation.
        :param string atStep: an optional string identifying the step to cancel prior to; must be
                               greater than the currently active step, and one of: `PREPROCESSING`,
                               `VALIDATING`, `IMPORTING`, `POSTPROCESSING`, `NOTIFYING`.

        :auth: required
        """

        logger.info("relocations.cancel.put.start", extra={"caller": request.user.id})

        try:
            relocation: Relocation = Relocation.objects.get(uuid=relocation_uuid)
        except Relocation.DoesNotExist:
            raise ResourceDoesNotExist

        if relocation.status == Relocation.Status.FAILURE.value:
            return self.respond(serialize(relocation))
        if relocation.status == Relocation.Status.SUCCESS.value:
            return Response(
                {"detail": ERR_NOT_CANCELLABLE_STATUS},
                status=400,
            )

        at_step = request.data.get("atStep", None)
        if at_step is not None:
            try:
                step = Relocation.Step[at_step.upper()]
            except KeyError:
                return Response(
                    {"detail": ERR_UNKNOWN_RELOCATION_STEP.substitute(step=at_step)},
                    status=400,
                )

            if step in {
                Relocation.Step.UNKNOWN,
                Relocation.Step.UPLOADING,
                Relocation.Step.COMPLETED,
            }:
                return Response(
                    {"detail": ERR_COULD_NOT_CANCEL_RELOCATION_AT_STEP.substitute(step=at_step)},
                    status=400,
                )

            try:
                relocation.scheduled_cancel_at_step = step.value
                relocation.save()
            except DatabaseError:
                return Response(
                    {"detail": ERR_COULD_NOT_CANCEL_RELOCATION},
                    status=400,
                )
            pass
        else:
            try:
                updated = Relocation.objects.filter(
                    uuid=relocation.uuid, step__lt=Relocation.Step.COMPLETED.value - 1
                ).update(scheduled_cancel_at_step=F("step") + 1)
                if not updated:
                    raise DatabaseError("Cannot set `scheduled_cancel_at_step` to `COMPLETED`")

                relocation.refresh_from_db()
            except DatabaseError:
                return Response(
                    {"detail": ERR_COULD_NOT_CANCEL_RELOCATION},
                    status=400,
                )

        return self.respond(serialize(relocation))
