import logging
from collections import defaultdict
from collections.abc import Sequence

from django.core.cache import cache

from sentry.deletions.base import ModelDeletionTask
from sentry.models.eventattachment import CRASH_REPORT_TYPES, EventAttachment, get_crashreport_key
from sentry.models.project import Project

logger = logging.getLogger(__name__)


class EventAttachmentDeletionTask(ModelDeletionTask[EventAttachment]):
    """
    Deletes EventAttachment rows in batches.

    The default ModelDeletionTask calls ``EventAttachment.delete()`` per row, which
    issues one SQL DELETE, one project lookup and one blob delete per attachment.
    This task deletes the whole batch with a single query and performs the
    side effects of ``EventAttachment.delete()`` (crash report cache pruning and
    blob deletion) in bulk.

    Blobs are deleted *before* their rows. If a blob delete fails, its row is kept
    and the error is re-raised so the deletion is retried instead of orphaning the
    stored payload.
    """

    def delete_instance_bulk(self, instance_list: Sequence[EventAttachment]) -> None:
        if not instance_list:
            return

        by_project: defaultdict[int, list[EventAttachment]] = defaultdict(list)
        for instance in instance_list:
            if instance.blob_path:
                by_project[instance.project_id].append(instance)

        failed_ids: set[int] = set()
        first_error: Exception | None = None
        for project_id, attachments in by_project.items():
            try:
                organization_id: int | None = Project.objects.get_from_cache(
                    id=project_id
                ).organization_id
            except Project.DoesNotExist:
                organization_id = None

            for attachment in attachments:
                try:
                    attachment.delete_blob(organization_id=organization_id)
                except Exception as e:
                    logger.exception(
                        "eventattachment.delete_blob.failed",
                        extra={"attachment_id": attachment.id, "project_id": project_id},
                    )
                    failed_ids.add(attachment.id)
                    if first_error is None:
                        first_error = e

        deleted = [i for i in instance_list if i.id not in failed_ids]
        if deleted:
            # A queryset delete does not run `EventAttachment.delete()`, so its side
            # effects are handled explicitly here.
            EventAttachment.objects.filter(id__in=[i.id for i in deleted]).delete()

            crashreport_keys = {
                get_crashreport_key(i.group_id)
                for i in deleted
                if i.group_id and i.type in CRASH_REPORT_TYPES
            }
            if crashreport_keys:
                cache.delete_many(list(crashreport_keys))

        if first_error is not None:
            # Keep rows whose blobs could not be deleted so the task retries them.
            raise first_error
