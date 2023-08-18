from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import region_silo_only_model
from sentry.models.files.abstractfileblobowner import AbstractFileBlobOwner


@region_silo_only_model
class FileBlobOwner(AbstractFileBlobOwner):
    __relocation_scope__ = RelocationScope.Excluded

    blob = FlexibleForeignKey("sentry.FileBlob")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_fileblobowner"
        unique_together = (("blob", "organization_id"),)
