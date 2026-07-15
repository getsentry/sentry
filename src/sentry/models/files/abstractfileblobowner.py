from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    ExternalDataMappingField,
    ExternalMappingType,
    Model,
)


class AbstractFileBlobOwner(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = ExternalDataMappingField(
        BoundedBigIntegerField(db_index=True),
        mapping_type=ExternalMappingType.POSTGRES,
        description="ID of the Organization that references this file blob",
    )

    class Meta:
        abstract = True
