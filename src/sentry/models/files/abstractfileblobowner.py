from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model


class AbstractFileBlobOwner(Model):
    __include_in_export__ = False
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)

    class Meta:
        abstract = True
