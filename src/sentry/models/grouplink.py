"""
sentry.models.groupseen
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from jsonfield import JSONField

from sentry.db.models import Model, sane_repr, BoundedBigIntegerField, BoundedPositiveIntegerField


class GroupLink(Model):
    """
    Link a group with an extenal resource like a commit, issue, or pull request
    """
    __core__ = False

    class Relationship:
        unknown = 0
        resolves = 1
        links = 2

    class LinkedType:
        unknown = 0
        commit = 1
        pull = 2
        issue = 3

    group_id = BoundedBigIntegerField()

    linked_type = BoundedPositiveIntegerField(
        default=LinkedType.commit,
        choices=((LinkedType.commit, _('Commit')),
                 (LinkedType.pull, _('Pull Request')),
                 (LinkedType.issue, _('Tracker Issue')), ),
    )

    linked_id = BoundedBigIntegerField()

    relationship = BoundedPositiveIntegerField(
        default=Relationship.links,
        choices=((Relationship.resolves, _('Resolves')),
                 (Relationship.links, _('Linked')), ),
    )

    data = JSONField()

    datetime = models.DateTimeField(default=timezone.now, db_index=True)

    unique_together = (('group_id', 'linked_type', 'linked_id'), )

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_grouplink'

    __repr__ = sane_repr('group_id', 'link', 'datetime')

    def get_actor_name(self):
        if self.actor:
            return self.actor.get_display_name()
        elif self.actor_key:
            return self.actor_key.key + ' (api key)'
        return self.actor_label
