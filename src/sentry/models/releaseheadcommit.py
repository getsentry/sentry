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
class ReleaseHeadCommit(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()
    release = FlexibleForeignKey("sentry.Release")
    commit = FlexibleForeignKey("sentry.Commit")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releaseheadcommit"
        unique_together = (("repository_id", "release"),)

    __repr__ = sane_repr("release_id", "commit_id", "repository_id")
