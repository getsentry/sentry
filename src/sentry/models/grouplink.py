from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    Model,
    sane_repr,
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    JSONField,
)


class GroupLink(Model):
    """
    Link a group with an external resource like a commit, issue, or pull request
    """

    __core__ = False

    class Relationship:
        unknown = 0
        resolves = 1
        references = 2

    class LinkedType:
        unknown = 0
        commit = 1
        pull_request = 2
        issue = 3

    group_id = BoundedBigIntegerField()
    project_id = BoundedBigIntegerField(db_index=True)
    linked_type = BoundedPositiveIntegerField(
        default=LinkedType.commit,
        choices=(
            (LinkedType.commit, _("Commit")),
            (LinkedType.pull_request, _("Pull Request")),
            (LinkedType.issue, _("Tracker Issue")),
        ),
    )
    linked_id = BoundedBigIntegerField()
    relationship = BoundedPositiveIntegerField(
        default=Relationship.references,
        choices=((Relationship.resolves, _("Resolves")), (Relationship.references, _("Linked"))),
    )
    data = JSONField()
    datetime = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_grouplink"
        unique_together = (("group_id", "linked_type", "linked_id"),)

    __repr__ = sane_repr("group_id", "linked_type", "linked_id", "relationship", "datetime")
