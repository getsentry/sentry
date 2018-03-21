from __future__ import absolute_import, print_function

from sentry.db.models import (
    BoundedBigIntegerField, Model, sane_repr
)


class LatestRelease(Model):
    """
    Tracks the latest release of a given repository for a given environment.
    """
    __core__ = False

    repository_id = BoundedBigIntegerField()
    # 0 for 'all environments'
    environment_id = BoundedBigIntegerField()
    release_id = BoundedBigIntegerField()
    deploy_id = BoundedBigIntegerField(null=True)
    commit_id = BoundedBigIntegerField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_latestrelease'
        unique_together = (('repository_id', 'environment_id'),)

    __repr__ = sane_repr('repository_id', 'environment_id')
