import logging
from string import Template

from django.db import DatabaseError
from django.db.models import F
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SuperuserOrStaffFeatureFlaggedPermission
from sentry.api.serializers import serialize
from sentry.relocation.api.endpoints import (
    ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP,
    ERR_UNKNOWN_RELOCATION_STEP,
)
from sentry.relocation.models.relocation import Relocation

ERR_NOT_PAUSABLE_STATUS = Template(
    """Relocations can only be paused if they are currently in progress; this relocation is
    `$status`."""
)
ERR_COULD_NOT_PAUSE_RELOCATION = (
    "Could not pause relocation, perhaps because it is no longer in-progress."
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class RelocationPauseEndpoint(Endpoint):
    owner = ApiOwner.HYBRID_CLOUD
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def put(self, request: Request, relocation_uuid: str) -> Response:
        """
        Pause an in-progress relocation.
        ``````````````````````````````````````````````````

        This command accepts a single optional parameter, which specifies the step BEFORE which the
        pause should occur. If no such parameter is specified, the pause is scheduled for the step
        immediately following the currently active one, if possible.

        :pparam string relocation_uuid: a UUID identifying the relocation.
        :param string atStep: an optional string identifying the step to pause at; must be greater
                               than the currently active step, and one of: `PREPROCESSING`,
                               `VALIDATING`, `IMPORTING`, `POSTPROCESSING`, `NOTIFYING`.

        :auth: required
        """

        logger.info("relocations.pause.put.start", extra={"caller": request.user.id})

        try:
            relocation: Relocation = Relocation.objects.get(uuid=relocation_uuid)
        except Relocation.DoesNotExist:
            raise ResourceDoesNotExist

        if relocation.status not in {
            Relocation.Status.IN_PROGRESS.value,
            Relocation.Status.PAUSE.value,
        }:
            return Response(
                {
                    "detail": ERR_NOT_PAUSABLE_STATUS.substitute(
                        status=Relocation.Status(relocation.status).name
                    )
                },
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
                    {"detail": ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(step=step.name)},
                    status=400,
                )

            try:
                relocation.scheduled_pause_at_step = step.value
                relocation.save()
            except DatabaseError:
                return Response(
                    {"detail": ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(step=step.name)},
                    status=400,
                )
        else:
            try:
                updated = Relocation.objects.filter(
                    uuid=relocation.uuid, step__lt=Relocation.Step.COMPLETED.value - 1
                ).update(scheduled_pause_at_step=F("step") + 1)
                if not updated:
                    raise DatabaseError("Cannot set `scheduled_pause_at_step` to `COMPLETED`")

                relocation.refresh_from_db()
            except DatabaseError:
                return Response(
                    {"detail": ERR_COULD_NOT_PAUSE_RELOCATION},
                    status=400,
                )

        return self.respond(serialize(relocation))
