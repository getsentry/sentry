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
from sentry.relocation.tasks import TASK_MAP
from sentry.utils.relocation import OrderedTask

ERR_NOT_RECOVERABLE_STATUS = Template(
    """Relocations can only be recovered if they have already failed; this relocation is
    `$status`."""
)
ERR_NOT_RECOVERABLE_STEP = "Relocations at the validation step cannot be recovered."
ERR_COULD_NOT_RECOVER_RELOCATION = (
    "Could not recover relocation, perhaps because it is no longer in a failed state."
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class RelocationRecoverEndpoint(Endpoint):
    owner = ApiOwner.OPEN_SOURCE
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def _recover(self, request: Request, relocation: Relocation) -> Response | None:
        """
        Helper function to do just... one... more... attempt of a the last task that the relocation
        failed at. Useful to try to recover a relocation after a fix has been pushed.
        """

        until_step = request.data.get("untilStep", None)
        if until_step is not None:
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

            if step.value <= relocation.step:
                return Response(
                    {"detail": ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(step=step.name)},
                    status=400,
                )

            relocation.scheduled_pause_at_step = step.value

        if relocation.status != Relocation.Status.FAILURE.value:
            return Response(
                {
                    "detail": ERR_NOT_RECOVERABLE_STATUS.substitute(
                        status=Relocation.Status(relocation.status).name
                    )
                },
                status=400,
            )

        ordered_task = OrderedTask[relocation.latest_task]
        task = TASK_MAP[ordered_task]
        if ordered_task in {OrderedTask.VALIDATING_POLL, OrderedTask.VALIDATING_COMPLETE}:
            return Response(
                {"detail": ERR_NOT_RECOVERABLE_STEP},
                status=400,
            )

        relocation.status = Relocation.Status.IN_PROGRESS.value
        relocation.latest_task_attempts -= 1

        try:
            relocation.save()
        except DatabaseError:
            return Response(
                {"detail": ERR_COULD_NOT_RECOVER_RELOCATION},
                status=400,
            )

        task.delay(str(relocation.uuid))
        return None

    def put(self, request: Request, relocation_uuid: str) -> Response:
        """
        Recover a failed relocation, perhaps after a bug fix, by running the last attempted task.
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

        logger.info("relocations.recover.put.start", extra={"caller": request.user.id})

        # Use a `select_for_update` transaction to prevent duplicate tasks from being started by
        # racing recover calls.
        with transaction.atomic(using=router.db_for_write(Relocation)):
            try:
                relocation: Relocation = Relocation.objects.select_for_update().get(
                    uuid=relocation_uuid
                )
            except Relocation.DoesNotExist:
                raise ResourceDoesNotExist

            failed = self._recover(request, relocation)
            if failed is not None:
                return failed

        return self.respond(serialize(relocation))
