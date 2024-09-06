from collections.abc import Sequence
from typing import Any

from django.core.files.base import ContentFile
from django.db import models

from sentry.celery import SentryTask
from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import region_silo_model
from sentry.models.files.abstractfile import AbstractFile
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobindex import FileBlobIndex
from sentry.tasks.files import delete_unreferenced_blobs_region


@region_silo_model
class File(AbstractFile[FileBlobIndex, FileBlob]):

    blobs = models.ManyToManyField("sentry.FileBlob", through="sentry.FileBlobIndex")

    # <Legacy fields>
    # Remove in 8.1
    blob = FlexibleForeignKey("sentry.FileBlob", null=True, related_name="legacy_blob")
    path = models.TextField(null=True)
    # </Legacy fields>

    class Meta:
        app_label = "sentry"
        db_table = "sentry_file"

    def _blob_index_records(self) -> Sequence[FileBlobIndex]:
        return list(
            FileBlobIndex.objects.filter(file=self).select_related("blob").order_by("offset")
        )

    def _create_blob_index(self, blob: FileBlob, offset: int) -> FileBlobIndex:
        return FileBlobIndex.objects.create(file=self, blob=blob, offset=offset)

    def _create_blob_from_file(self, contents: ContentFile, logger: Any) -> FileBlob:
        return FileBlob.from_file(contents, logger)

    def _get_blobs_by_id(self, blob_ids: Sequence[int]) -> models.QuerySet[FileBlob]:
        return FileBlob.objects.filter(id__in=blob_ids).all()

    def _delete_unreferenced_blob_task(self) -> SentryTask:
        return delete_unreferenced_blobs_region
