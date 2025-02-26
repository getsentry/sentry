import logging
from string import Template

from django.db import router
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import capture_exception

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.models.files.file import File
from sentry.relocation.api.endpoints.index import (
    get_autopause_value,
    validate_new_relocation_request,
    validate_relocation_uniqueness,
)
from sentry.relocation.models.relocation import Relocation, RelocationFile
from sentry.relocation.tasks.process import uploading_start
from sentry.signals import relocation_retry_link_promo_code
from sentry.users.services.user.service import user_service
from sentry.utils.db import atomic_transaction

ERR_NOT_RETRYABLE_STATUS = Template(
    "Relocations can only be retried if they have already failed; this relocation is `$status`."
)
ERR_OWNER_NO_LONGER_EXISTS = "The owner of this relocation no longer exists."
ERR_FILE_NO_LONGER_EXISTS = (
    "The relocation file no longer exists, probably due to data retention requirements."
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class RelocationRetryEndpoint(Endpoint):
    owner = ApiOwner.OPEN_SOURCE
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SentryIsAuthenticated,)

    def post(self, request: Request, relocation_uuid: str) -> Response:
        """
        Retry a failed relocation.
        ``````````````````````````````````````````````````

        :pparam string relocation_uuid: a UUID identifying the relocation to be retried.

        :auth: required
        """

        logger.info("relocations.retry.post.start", extra={"caller": request.user.id})

        relocation = Relocation.objects.filter(uuid=relocation_uuid).first()
        if relocation is None:
            raise ResourceDoesNotExist
        if relocation.status != Relocation.Status.FAILURE.value:
            return Response(
                {
                    "detail": ERR_NOT_RETRYABLE_STATUS.substitute(
                        status=Relocation.Status(relocation.status).name
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        relocation_file = (
            RelocationFile.objects.filter(relocation=relocation).select_related("file").first()
        )
        if relocation_file is None:
            return Response(
                {"detail": ERR_FILE_NO_LONGER_EXISTS},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # We can re-use the same `File` instance in the database, avoiding duplicating data.
        try:
            file = File.objects.get(id=relocation_file.file_id)
            fileobj = file.getfile()
        except (File.DoesNotExist, FileNotFoundError):
            return Response(
                {"detail": ERR_FILE_NO_LONGER_EXISTS},
                status=status.HTTP_400_BAD_REQUEST,
            )

        owner = user_service.get_user(user_id=relocation.owner_id)
        if owner is None:
            return Response(
                {"detail": ERR_OWNER_NO_LONGER_EXISTS},
                status=status.HTTP_400_BAD_REQUEST,
            )

        err = validate_new_relocation_request(
            request, owner.username, relocation.want_org_slugs, fileobj.size
        ) or validate_relocation_uniqueness(owner)
        if err is not None:
            return err

        with atomic_transaction(
            using=(router.db_for_write(Relocation), router.db_for_write(RelocationFile))
        ):
            new_relocation = Relocation.objects.create(
                creator_id=request.user.id,
                owner_id=relocation.owner_id,
                want_org_slugs=relocation.want_org_slugs,
                step=Relocation.Step.UPLOADING.value,
                scheduled_pause_at_step=get_autopause_value(
                    Relocation.Provenance(relocation.provenance)
                ),
                provenance=relocation.provenance,
            )

            relocation_retry_link_promo_code.send_robust(
                old_relocation_uuid=relocation_uuid,
                new_relocation_uuid=new_relocation.uuid,
                sender=self.__class__,
            )
            RelocationFile.objects.create(
                relocation=new_relocation,
                file=file,
                kind=RelocationFile.Kind.RAW_USER_DATA.value,
            )

        uploading_start.delay(new_relocation.uuid, None, None)
        try:
            analytics.record(
                "relocation.created",
                creator_id=request.user.id,
                owner_id=owner.id,
                uuid=str(new_relocation.uuid),
            )
        except Exception as e:
            capture_exception(e)

        return Response(serialize(new_relocation), status=status.HTTP_201_CREATED)
