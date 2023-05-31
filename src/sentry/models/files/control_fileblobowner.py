from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import control_silo_only_model
from sentry.models.files.abstractfileblobowner import AbstractFileBlobOwner


@control_silo_only_model
class ControlFileBlobOwner(AbstractFileBlobOwner):
    __include_in_export__ = False

    blob = FlexibleForeignKey("sentry.ControlFileBlob")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlfileblobowner"
        unique_together = (("blob", "organization_id"),)
