from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr)
from sentry.utils.grouprefence import find_referenced_groups


class ChangeRequest(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()

    key = models.CharField(max_length=64)  # example, 5131 on github

    date_added = models.DateTimeField(default=timezone.now)

    commits = models.ManyToManyField('sentry.Commit')
    title = models.TextField()
    message = models.TextField()
    author = FlexibleForeignKey('sentry.CommitAuthor', null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_change_request'
        index_together = (('repository_id', 'date_added'), )
        unique_together = (('repository_id', 'key'), )

    __repr__ = sane_repr('organization_id', 'repository_id', 'key')

    def find_referenced_groups(self):
        text = "{} {}".format(self.message, self.title)
        return find_referenced_groups(text, self.organization_id)
