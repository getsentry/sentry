import logging
from string import Template

from django.db import DatabaseError, router, transaction
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
from sentry.relocation.tasks.process import get_first_task_for_step

ERR_NOT_UNPAUSABLE_STATUS = Template(
    """Relocations can only be unpaused if they are already paused; this relocation is
    `$status`."""
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class RelocationUnpauseEndpoint(Endpoint):
    owner = ApiOwner.OPEN_SOURCE
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def _unpause(self, request: Request, relocation: Relocation) -> Response | None:
        """
        Helper function to do the actual unpausing in a transaction-safe manner. It will only return
        a `Response` if the relocation failed - otherwise, it will return `None` and let the calling
        function perform the serialization for the return payload.
        """
        existing_scheduled_pause_at_step = relocation.scheduled_pause_at_step
        until_step = request.data.get("untilStep", None)
        if until_step is None:
            relocation.scheduled_pause_at_step = None
        else:
            try:
                step = Relocation.Step[until_step.upper()]
            except KeyError:
                return Response(
                    {"detail": ERR_UNKNOWN_RELOCATION_STEP.substitute(step=until_step)},
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

            relocation.scheduled_pause_at_step = step.value

        # If this task is still in progress, but has a future pause scheduled, go ahead and
        # remove it and do nothing else.
        if (
            relocation.status == Relocation.Status.IN_PROGRESS.value
            and existing_scheduled_pause_at_step is not None
        ):
            try:
                relocation.save()
                return None
            except DatabaseError:
                return Response(
                    {"detail": ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(step=step.name)},
                    status=400,
                )

        # If we reach this point, we must be restarting a currently paused task.
        if relocation.status != Relocation.Status.PAUSE.value:
            return Response(
                {
                    "detail": ERR_NOT_UNPAUSABLE_STATUS.substitute(
                        status=Relocation.Status(relocation.status).name
                    )
                },
                status=400,
            )

        relocation.status = Relocation.Status.IN_PROGRESS.value
        relocation.latest_task_attempts = 0

        task = get_first_task_for_step(Relocation.Step(relocation.step))
        if task is None:
            raise RuntimeError("Unknown relocation task")

        # Save the model first, since we can do so multiple times if the task scheduling fails.
        try:
            relocation.save()
        except DatabaseError:
            return Response(
                {"detail": ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(step=step.name)},
                status=400,
            )

        task.delay(str(relocation.uuid))
        return None

    def put(self, request: Request, relocation_uuid: str) -> Response:
        """
        Unpause an in-progress relocation.
        ``````````````````````````````````````````````````

        This command accepts a single optional parameter, which specifies the step BEFORE which the
        next pause should occur. If no such parameter is specified, no future pauses are scheduled.

        :pparam string relocation_uuid: a UUID identifying the relocation.
        :param string untilStep: an optional string identifying the next step to pause before; must
                                 be greater than the currently active step, and one of:
                                 `PREPROCESSING`, `VALIDATING`, `IMPORTING`, `POSTPROCESSING`,
                                 `NOTIFYING`.

        :auth: required
        """

        logger.info("relocations.unpause.put.start", extra={"caller": request.user.id})

        # Use a `select_for_update` transaction to prevent duplicate tasks from being started by
        # racing unpause calls.
        with transaction.atomic(using=router.db_for_write(Relocation)):
            try:
                relocation: Relocation = Relocation.objects.select_for_update().get(
                    uuid=relocation_uuid
                )
            except Relocation.DoesNotExist:
                raise ResourceDoesNotExist

            failed = self._unpause(request, relocation)
            if failed is not None:
                return failed

        return self.respond(serialize(relocation))
