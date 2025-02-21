# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import logging
from datetime import UTC, datetime
from io import BytesIO
from uuid import UUID

from django.db import router
from django.db.utils import IntegrityError
from sentry_sdk import capture_exception

from sentry.hybridcloud.models.outbox import ControlOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.files.file import File
from sentry.models.files.utils import get_relocation_storage
from sentry.relocation.models.relocation import Relocation, RelocationFile
from sentry.relocation.services.relocation_export.model import (
    RelocationExportReplyWithExportParameters,
    RelocationExportRequestNewExportParameters,
)
from sentry.relocation.services.relocation_export.service import (
    ControlRelocationExportService,
    RegionRelocationExportService,
)
from sentry.relocation.utils import RELOCATION_BLOB_SIZE, RELOCATION_FILE_TYPE, uuid_to_identifier
from sentry.utils.db import atomic_transaction

logger = logging.getLogger(__name__)


class DBBackedRelocationExportService(RegionRelocationExportService):
    def request_new_export(
        self,
        *,
        relocation_uuid: str,
        requesting_region_name: str,
        replying_region_name: str,
        org_slug: str,
        encrypt_with_public_key: bytes,
    ) -> None:
        from sentry.relocation.tasks import fulfill_cross_region_export_request

        logger_data = {
            "uuid": relocation_uuid,
            "requesting_region_name": requesting_region_name,
            "replying_region_name": replying_region_name,
            "org_slug": org_slug,
            "encrypted_bytes_size": len(encrypt_with_public_key),
        }
        logger.info("SaaS -> SaaS request received in exporting region", extra=logger_data)

        # This task will do the actual work of performing the export and saving it to this regions
        # "relocation" GCS bucket. It is annotated with the appropriate retry, back-off etc logic
        # for robustness' sake. The last action performed by this task is to call an instance of
        # `ControlRelocationExportService.reply_with_export` via a manually-scheduled
        # `RegionOutbox`, which will handle the task of asynchronously delivering the encrypted,
        # newly-exported bytes.
        fulfill_cross_region_export_request.apply_async(
            args=[
                relocation_uuid,
                requesting_region_name,
                replying_region_name,
                org_slug,
                encrypt_with_public_key,
                int(round(datetime.now(tz=UTC).timestamp())),
            ]
        )
        logger.info("SaaS -> SaaS exporting task scheduled", extra=logger_data)

    def reply_with_export(
        self,
        *,
        relocation_uuid: str,
        requesting_region_name: str,
        replying_region_name: str,
        org_slug: str,
        # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
        encrypted_contents: bytes | None,
        encrypted_bytes: list[int] | None = None,
    ) -> None:
        from sentry.relocation.tasks import uploading_complete

        with atomic_transaction(
            using=(
                router.db_for_write(Relocation),
                router.db_for_write(RelocationFile),
                router.db_for_write(File),
            )
        ):
            logger_data = {
                "uuid": relocation_uuid,
                "requesting_region_name": requesting_region_name,
                "replying_region_name": replying_region_name,
                "org_slug": org_slug,
                # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
                "encrypted_bytes_size": len(encrypted_bytes or []),
            }
            logger.info("SaaS -> SaaS reply received in triggering region", extra=logger_data)

            try:
                relocation: Relocation = Relocation.objects.get(uuid=relocation_uuid)
            except Relocation.DoesNotExist as e:
                logger.exception("Could not locate Relocation model by UUID: %s", relocation_uuid)
                capture_exception(e)
                return

            # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
            fp = BytesIO(bytes(encrypted_bytes or []))
            file = File.objects.create(name="raw-relocation-data.tar", type=RELOCATION_FILE_TYPE)
            file.putfile(fp, blob_size=RELOCATION_BLOB_SIZE, logger=logger)
            logger.info("SaaS -> SaaS relocation underlying File created", extra=logger_data)

            # This write ensures that the entire chain triggered by `uploading_start` remains
            # idempotent, since only one (relocation_uuid, relocation_file_kind) pairing can exist
            # in that database's table at a time. If we try to write a second, it will fail due to
            # that unique constraint.
            try:
                RelocationFile.objects.create(
                    relocation=relocation,
                    file=file,
                    kind=RelocationFile.Kind.RAW_USER_DATA.value,
                )
            except IntegrityError:
                # We already have the file, we can proceed.
                pass

            logger.info("SaaS -> SaaS relocation RelocationFile saved", extra=logger_data)

            uploading_complete.apply_async(args=[relocation.uuid])
            logger.info("SaaS -> SaaS relocation next task scheduled", extra=logger_data)


class ProxyingRelocationExportService(ControlRelocationExportService):
    def request_new_export(
        self,
        *,
        relocation_uuid: str,
        requesting_region_name: str,
        replying_region_name: str,
        org_slug: str,
        encrypt_with_public_key: bytes,
    ) -> None:
        logger_data = {
            "uuid": relocation_uuid,
            "requesting_region_name": requesting_region_name,
            "replying_region_name": replying_region_name,
            "org_slug": org_slug,
            "encrypt_with_public_key_size": len(encrypt_with_public_key),
        }
        logger.info("SaaS -> SaaS request received on proxy", extra=logger_data)

        # Saving this outbox "proxies" the request to the correct region.
        identifier = uuid_to_identifier(UUID(relocation_uuid))
        payload = RelocationExportRequestNewExportParameters(
            relocation_uuid=relocation_uuid,
            requesting_region_name=requesting_region_name,
            replying_region_name=replying_region_name,
            org_slug=org_slug,
            encrypt_with_public_key=encrypt_with_public_key,
        ).dict()
        ControlOutbox(
            region_name=replying_region_name,
            shard_scope=OutboxScope.RELOCATION_SCOPE,
            category=OutboxCategory.RELOCATION_EXPORT_REQUEST,
            shard_identifier=identifier,
            object_identifier=identifier,
            payload=payload,
        ).save()
        logger.info("SaaS -> SaaS request proxy outbox saved", extra=logger_data)

    def reply_with_export(
        self,
        *,
        relocation_uuid: str,
        requesting_region_name: str,
        replying_region_name: str,
        org_slug: str,
        # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
        encrypted_contents: bytes | None,
        encrypted_bytes: list[int] | None = None,
    ) -> None:
        logger_data = {
            "uuid": relocation_uuid,
            "requesting_region_name": requesting_region_name,
            "replying_region_name": replying_region_name,
            "org_slug": org_slug,
            # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
            "encrypted_bytes_size": len(encrypted_bytes or []),
        }
        logger.info("SaaS -> SaaS reply received on proxy", extra=logger_data)

        # Save the payload into the control silo's "relocation" GCS bucket. This bucket is only used
        # for temporary storage of `encrypted_bytes` being shuffled between regions like this.
        path = f"runs/{relocation_uuid}/saas_to_saas_export/{org_slug}.tar"
        relocation_storage = get_relocation_storage()
        # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
        fp = BytesIO(bytes(encrypted_bytes or []))
        relocation_storage.save(path, fp)
        logger.info("SaaS -> SaaS export contents retrieved", extra=logger_data)

        # Saving this outbox "proxies" the reply to the correct region.
        identifier = uuid_to_identifier(UUID(relocation_uuid))
        payload = RelocationExportReplyWithExportParameters(
            relocation_uuid=relocation_uuid,
            requesting_region_name=requesting_region_name,
            replying_region_name=replying_region_name,
            org_slug=org_slug,
        ).dict()
        ControlOutbox(
            region_name=requesting_region_name,
            shard_scope=OutboxScope.RELOCATION_SCOPE,
            category=OutboxCategory.RELOCATION_EXPORT_REPLY,
            shard_identifier=identifier,
            object_identifier=identifier,
            payload=payload,
        ).save()
        logger.info("SaaS -> SaaS reply proxy outbox saved", extra=logger_data)
