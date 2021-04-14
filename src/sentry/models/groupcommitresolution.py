from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, Model, sane_repr


class GroupCommitResolution(Model):
    """
    When a Group is referenced via a commit, its association is stored here.
    """

    __core__ = False

    group_id = BoundedBigIntegerField()
    commit_id = BoundedBigIntegerField(db_index=True)
    datetime = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "sentry_groupcommitresolution"
        app_label = "sentry"
        unique_together = (("group_id", "commit_id"),)

    __repr__ = sane_repr("group_id", "commit_id")
