from collections.abc import Sequence
from typing import Any

from django.core.files.base import ContentFile
from django.db import models

from sentry.celery import SentryTask
from sentry.db.models.base import control_silo_model
from sentry.models.files.abstractfile import AbstractFile
from sentry.models.files.control_fileblob import ControlFileBlob
from sentry.models.files.control_fileblobindex import ControlFileBlobIndex
from sentry.tasks.files import delete_unreferenced_blobs_control


@control_silo_model
class ControlFile(AbstractFile[ControlFileBlobIndex, ControlFileBlob]):
    blobs = models.ManyToManyField("sentry.ControlFileBlob", through="sentry.ControlFileBlobIndex")
    # Looking for the "blob" FK or the path attribute? These are deprecated and unavailable in the control silo

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlfile"

    FILE_BLOB_MODEL = ControlFileBlob
    FILE_BLOB_INDEX_MODEL = ControlFileBlobIndex
    DELETE_UNREFERENCED_BLOB_TASK = delete_unreferenced_blobs_control

    def _blob_index_records(self) -> Sequence[ControlFileBlobIndex]:
        return list(
            ControlFileBlobIndex.objects.filter(file=self).select_related("blob").order_by("offset")
        )

    def _create_blob_index(self, blob: ControlFileBlob, offset: int) -> ControlFileBlobIndex:
        return ControlFileBlobIndex.objects.create(file=self, blob=blob, offset=offset)

    def _create_blob_from_file(self, contents: ContentFile, logger: Any) -> ControlFileBlob:
        return ControlFileBlob.from_file(contents, logger)

    def _get_blobs_by_id(self, blob_ids: Sequence[int]) -> models.QuerySet[ControlFileBlob]:
        return ControlFileBlob.objects.filter(id__in=blob_ids).all()

    def _delete_unreferenced_blob_task(self) -> SentryTask:
        return delete_unreferenced_blobs_control
