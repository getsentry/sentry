from __future__ import absolute_import, print_function

from sentry.db.models import BoundedPositiveIntegerField
from sentry.db.models import FlexibleForeignKey
from sentry.db.models import Model
from sentry.db.models import sane_repr


class CommitFileLineChange(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    commit = FlexibleForeignKey("sentry.Commit")
    filechange = FlexibleForeignKey("sentry.CommitFileChange")
    author = FlexibleForeignKey("sentry.CommitAuthor", null=True)
    line_start = BoundedPositiveIntegerField()
    line_end = BoundedPositiveIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_commitfilelinechange"
        unique_together = (("commit", "author", "filechange", "line_start", "line_end"),)

    __repr__ = sane_repr("commit_id", "author", "filechange", "line_start", "line_end")
