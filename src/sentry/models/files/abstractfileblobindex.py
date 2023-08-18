from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedPositiveIntegerField, Model


class AbstractFileBlobIndex(Model):
    __include_in_export__ = False
    __relocation_scope__ = RelocationScope.Excluded

    offset = BoundedPositiveIntegerField()

    class Meta:
        abstract = True
