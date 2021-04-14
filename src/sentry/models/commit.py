from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.utils.cache import memoize
from sentry.utils.groupreference import find_referenced_groups


class Commit(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()
    key = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)
    # all commit metadata must be optional, as it may not be available
    # when the initial commit object is referenced (and thus created)
    author = FlexibleForeignKey("sentry.CommitAuthor", null=True)
    message = models.TextField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_commit"
        index_together = (("repository_id", "date_added"),)
        unique_together = (("repository_id", "key"),)

    __repr__ = sane_repr("organization_id", "repository_id", "key")

    @memoize
    def title(self):
        if not self.message:
            return ""
        return self.message.splitlines()[0]

    @memoize
    def short_id(self):
        if len(self.key) == 40:
            return self.key[:7]
        return self.key

    def find_referenced_groups(self):
        return find_referenced_groups(self.message, self.organization_id)
