from sentry.db.models import control_silo_only_model
from sentry.models.files.abstractfileblob import AbstractFileBlob
from sentry.models.files.control_fileblobowner import ControlFileBlobOwner


@control_silo_only_model
class ControlFileBlob(AbstractFileBlob):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlfileblob"

    FILE_BLOB_OWNER_MODEL = ControlFileBlobOwner
