from sentry.db.models import control_silo_model
from sentry.models.files.abstractfileblobpending import AbstractFileBlobPending


@control_silo_model
class ControlFileBlobPending(AbstractFileBlobPending):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlfileblobpending"
