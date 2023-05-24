from sentry.db.models import region_silo_only_model
from sentry.models.files.abstractfileblob import AbstractFileBlob
from sentry.models.files.fileblobowner import FileBlobOwner


@region_silo_only_model
class FileBlob(AbstractFileBlob):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_fileblob"

    FILE_BLOB_OWNER_MODEL = FileBlobOwner
