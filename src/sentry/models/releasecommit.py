from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    ExternalDataMappingField,
    ExternalMappingType,
    FlexibleForeignKey,
    Model,
    cell_silo_model,
    sane_repr,
)


@cell_silo_model
class ReleaseCommit(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = ExternalDataMappingField(
        BoundedBigIntegerField(db_index=True),
        mapping_type=ExternalMappingType.POSTGRES,
        description="ID of the Organization the release and commit belong to",
    )
    # DEPRECATED
    project_id = ExternalDataMappingField(
        BoundedBigIntegerField(null=True),
        mapping_type=ExternalMappingType.POSTGRES,
        description="Deprecated ID of the Project the release commit was associated with",
    )
    release = FlexibleForeignKey("sentry.Release")
    commit = FlexibleForeignKey("sentry.Commit", db_constraint=False)
    order = BoundedPositiveIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releasecommit"
        unique_together = (("release", "commit"), ("release", "order"))

    __repr__ = sane_repr("release_id", "commit_id", "order")
