from typing import int
from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, WrappingU32IntegerField


class AbstractFileBlobIndex(Model):
    __relocation_scope__ = RelocationScope.Excluded

    offset = WrappingU32IntegerField()

    class Meta:
        abstract = True
