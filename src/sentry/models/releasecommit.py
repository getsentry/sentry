from __future__ import absolute_import, print_function

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)


class ReleaseCommit(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True, null=True)
    project_id = BoundedPositiveIntegerField(db_index=True)
    release = FlexibleForeignKey('sentry.Release')
    commit = FlexibleForeignKey('sentry.Commit')
    order = BoundedPositiveIntegerField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_releasecommit'
        unique_together = (
            ('release', 'commit'),
            ('release', 'order'),
        )

    __repr__ = sane_repr('release_id', 'commit_id', 'order')
