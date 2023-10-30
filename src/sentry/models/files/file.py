from django.db import models

from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import region_silo_only_model
from sentry.models.files.abstractfile import AbstractFile
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobindex import FileBlobIndex
from sentry.tasks.files import delete_unreferenced_blobs_region


@region_silo_only_model
class File(AbstractFile):

    blobs = models.ManyToManyField("sentry.FileBlob", through="sentry.FileBlobIndex")
    # <Legacy fields>
    # Remove in 8.1
    blob = FlexibleForeignKey("sentry.FileBlob", null=True, related_name="legacy_blob")
    path = models.TextField(null=True)
    # </Legacy fields>

    class Meta:
        app_label = "sentry"
        db_table = "sentry_file"

    FILE_BLOB_MODEL = FileBlob
    FILE_BLOB_INDEX_MODEL = FileBlobIndex
    DELETE_UNREFERENCED_BLOB_TASK = delete_unreferenced_blobs_region
