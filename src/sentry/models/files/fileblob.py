from sentry.celery import SentryTask
from sentry.db.models import region_silo_model
from sentry.models.files.abstractfileblob import AbstractFileBlob
from sentry.models.files.fileblobowner import FileBlobOwner
from sentry.tasks.files import delete_file_region


@region_silo_model
class FileBlob(AbstractFileBlob[FileBlobOwner]):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_fileblob"

    @classmethod
    def _storage_config(cls):
        return None  # Rely on get_storage defaults

    def _create_blob_owner(self, organization_id: int) -> FileBlobOwner:
        return FileBlobOwner.objects.create(organization_id=organization_id, blob=self)

    def _delete_file_task(self) -> SentryTask:
        return delete_file_region
