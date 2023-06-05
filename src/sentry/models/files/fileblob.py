from sentry.db.models import region_silo_only_model
from sentry.models.files.abstractfileblob import AbstractFileBlob
from sentry.models.files.fileblobowner import FileBlobOwner
from sentry.tasks.files import delete_file_region


@region_silo_only_model
class FileBlob(AbstractFileBlob):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_fileblob"

    FILE_BLOB_OWNER_MODEL = FileBlobOwner
    DELETE_FILE_TASK = delete_file_region

    @classmethod
    def _storage_config(cls):
        return None  # Rely on get_storage defaults
