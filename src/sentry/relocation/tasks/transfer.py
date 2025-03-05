import logging

from celery import Task
from django.db.models import Subquery
from django.utils import timezone
from sentry_sdk import capture_exception

from sentry.models.files.utils import get_relocation_storage
from sentry.relocation.models.relocationtransfer import (
    MAX_AGE,
    RETRY_BACKOFF,
    BaseRelocationTransfer,
    ControlRelocationTransfer,
    RegionRelocationTransfer,
    RelocationTransferState,
)
from sentry.relocation.services.relocation_export.service import (
    control_relocation_export_service,
    region_relocation_export_service,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.types.region import get_local_region

logger = logging.getLogger("sentry.relocation.tasks")


@instrumented_task(
    name="sentry.relocation.transfer.find_relocation_transfer_control",
    queue="relocation.control",
    silo_mode=SiloMode.CONTROL,
)
def find_relocation_transfer_control() -> None:
    _find_relocation_transfer(ControlRelocationTransfer, process_relocation_transfer_control)


@instrumented_task(
    name="sentry.relocation.transfer.find_relocation_transfer_region",
    queue="relocation",
    silo_mode=SiloMode.REGION,
)
def find_relocation_transfer_region() -> None:
    _find_relocation_transfer(RegionRelocationTransfer, process_relocation_transfer_region)


def _find_relocation_transfer(
    model_cls: type[BaseRelocationTransfer],
    process_task: Task,
) -> None:
    """
    Advance the scheduled_for time for all transfers that are
    due, and schedule processing tasks for them.
    """
    now = timezone.now()
    scheduled_ids = model_cls.objects.filter(
        scheduled_for__lte=now,
        date_added__gte=now - MAX_AGE,
    ).values("id")

    for transfer_id in scheduled_ids:
        process_task.delay(id=transfer_id)

    if len(scheduled_ids):
        # Advance next retry time in case these deliveries fail.
        model_cls.objects.filter(id__in=Subquery(scheduled_ids)).update(
            scheduled_for=timezone.now() + RETRY_BACKOFF
        )

    # Garbage collect expired transfers. Because relocations are
    # expected to complete in 1 hour we should purge transfers older than
    # that.
    now = timezone.now()
    expired = model_cls.objects.filter(date_added__lte=now - MAX_AGE)
    for item in expired:
        logger.warning(
            "relocation.expired",
            extra={
                "relocation_uuid": item.relocation_uuid,
                "org_slug": item.org_slug,
                "requesting_region": item.requesting_region,
                "exporting_region": item.exporting_region,
            },
        )
        item.delete()


@instrumented_task(
    name="sentry.relocation.transfer.process_relocation_transfer_control",
    queue="relocation.control",
    silo_mode=SiloMode.CONTROL,
)
def process_relocation_transfer_control(transfer_id: int) -> None:
    log_context = {"id": transfer_id, "silo": "control"}
    try:
        transfer = ControlRelocationTransfer.objects.get(id=transfer_id)
    except ControlRelocationTransfer.DoesNotExist:
        logging.warning("relocation.transfer_missing", extra=log_context)
        return
    log_context["state"] = transfer.state
    log_context["relocation_uuid"] = str(transfer.relocation_uuid)

    if transfer.state == RelocationTransferState.Request:
        public_key = transfer.public_key or b""
        if public_key:
            public_key = bytes(public_key)

        # Forward the export request to the exporting region.
        try:
            region_relocation_export_service.request_new_export(
                relocation_uuid=str(transfer.relocation_uuid),
                requesting_region_name=transfer.requesting_region,
                replying_region_name=transfer.exporting_region,
                org_slug=transfer.org_slug,
                encrypt_with_public_key=public_key,
            )
            # Once the RPC is successful, we're done with this transfer.
            transfer.delete()
        except Exception as err:
            logging.warning(
                "relocation.transfer_failed",
                extra={
                    **log_context,
                    "error": str(err),
                },
            )
            capture_exception(err)
    elif transfer.state == RelocationTransferState.Reply:
        # We expect the `ProxyRelocationExportService::reply_with_export` implementation to have
        # written the export data to the control silo's local relocation-specific GCS bucket. Here,
        # we just read it into memory and attempt the RPC back to the requesting region.
        uuid = transfer.relocation_uuid
        slug = transfer.org_slug

        relocation_storage = get_relocation_storage()
        path = f"runs/{uuid}/saas_to_saas_export/{slug}.tar"
        try:
            encrypted_bytes = relocation_storage.open(path)
        except Exception as err:
            logger.warning(
                "relocation.failed_open_reply",
                extra={
                    **log_context,
                    "error": str(err),
                },
            )
            capture_exception(err)
            return

        try:
            with encrypted_bytes:
                # Move encrypted bytes to the requesting region.
                region_relocation_export_service.reply_with_export(
                    relocation_uuid=str(transfer.relocation_uuid),
                    requesting_region_name=transfer.requesting_region,
                    replying_region_name=transfer.exporting_region,
                    org_slug=slug,
                    # TODO(mark): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
                    encrypted_contents=None,
                    encrypted_bytes=[int(byte) for byte in encrypted_bytes.read()],
                )
                # We are done with this stage of the transfer
                transfer.delete()
        except Exception as err:
            logger.warning(
                "relocation.failed_rpc_reply",
                extra={
                    **log_context,
                    "error": str(err),
                },
            )
            capture_exception(err)
            return


@instrumented_task(
    name="sentry.relocation.transfer.process_relocation_transfer_region",
    queue="relocation",
    silo_mode=SiloMode.REGION,
)
def process_relocation_transfer_region(transfer_id: int) -> None:
    log_context = {"id": transfer_id, "silo": "region", "region": get_local_region().name}

    try:
        transfer = RegionRelocationTransfer.objects.get(id=transfer_id)
    except RegionRelocationTransfer.DoesNotExist:
        logging.warning("relocation.transfer_missing", extra=log_context)
        return

    uuid = str(transfer.relocation_uuid)
    slug = transfer.org_slug

    log_context["state"] = transfer.state
    log_context["relocation_uuid"] = uuid

    if transfer.state == RelocationTransferState.Reply:
        relocation_storage = get_relocation_storage()
        path = f"runs/{uuid}/saas_to_saas_export/{slug}.tar"
        try:
            encrypted_bytes = relocation_storage.open(path)
        except Exception as err:
            logger.warning(
                "relocation.failed_open.export",
                extra={
                    **log_context,
                    "error": str(err),
                },
            )
            capture_exception(err)
            return

        with encrypted_bytes:
            control_relocation_export_service.reply_with_export(
                relocation_uuid=uuid,
                requesting_region_name=transfer.requesting_region,
                replying_region_name=transfer.exporting_region,
                org_slug=slug,
                # TODO(mark): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
                encrypted_contents=None,
                encrypted_bytes=[int(byte) for byte in encrypted_bytes.read()],
            )
        # Remove the transfer once the reply is sent.
        transfer.delete()
    else:
        logger.warning("relocation.transfer_invalid_state", extra=log_context)
        transfer.delete()
