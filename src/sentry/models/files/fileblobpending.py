from sentry.db.models import cell_silo_model
from sentry.models.files.abstractfileblobpending import AbstractFileBlobPending


@cell_silo_model
class FileBlobPending(AbstractFileBlobPending):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_fileblobpending"
