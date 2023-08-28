from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)


@region_silo_only_model
class ReleaseCommit(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    # DEPRECATED
    project_id = BoundedBigIntegerField(null=True)
    release = FlexibleForeignKey("sentry.Release")
    commit = FlexibleForeignKey("sentry.Commit")
    order = BoundedPositiveIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releasecommit"
        unique_together = (("release", "commit"), ("release", "order"))

    __repr__ = sane_repr("release_id", "commit_id", "order")
