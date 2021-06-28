from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class ReleaseHeadCommit(Model):
    __include_in_export__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()
    release = FlexibleForeignKey("sentry.Release")
    commit = FlexibleForeignKey("sentry.Commit")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releaseheadcommit"
        unique_together = (("repository_id", "release"),)

    __repr__ = sane_repr("release_id", "commit_id", "repository_id")
