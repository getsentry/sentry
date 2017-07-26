from __future__ import absolute_import, print_function

import re

from django.db import models
from django.utils import timezone

from sentry.db.models import (BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr)
from sentry.utils.cache import memoize

_fixes_re = re.compile(
    r'\b(?:Fix|Fixes|Fixed|Close|Closes|Closed|Resolve|Resolves|Resolved)\s+([A-Za-z0-9_\-\s\,]+)\b',
    re.I
)
_short_id_re = re.compile(r'\b([A-Z0-9_-]+-[A-Z0-9]+)\b', re.I)


class Commit(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()
    key = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)
    # all commit metadata must be optional, as it may not be available
    # when the initial commit object is referenced (and thus created)
    author = FlexibleForeignKey('sentry.CommitAuthor', null=True)
    message = models.TextField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_commit'
        index_together = (('repository_id', 'date_added'), )
        unique_together = (('repository_id', 'key'), )

    __repr__ = sane_repr('organization_id', 'repository_id', 'key')

    @memoize
    def title(self):
        if not self.message:
            return ''
        return self.message.splitlines()[0]

    @memoize
    def short_id(self):
        if len(self.key) == 40:
            return self.key[:7]
        return self.key

    def find_referenced_groups(self):
        from sentry.models import Group

        if not self.message:
            return []

        results = set()
        for fmatch in _fixes_re.finditer(self.message):
            for smatch in _short_id_re.finditer(fmatch.group(1)):
                short_id = smatch.group(1)
                try:
                    group = Group.objects.by_qualified_short_id(
                        organization_id=self.organization_id,
                        short_id=short_id,
                    )
                except Group.DoesNotExist:
                    continue
                else:
                    results.add(group)
        return results
