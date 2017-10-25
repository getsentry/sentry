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
from sentry.db.models import FlexibleForeignKey, Model, sane_repr, BoundedPositiveIntegerField, GzippedDictField


class GroupLink(Model):
    """
    Link a group with an extenal resource like a commit, issue, or pull request
    """
    __core__ = False

    class Status:
        commit = 0
        pull = 1
        issue = 2

    group = FlexibleForeignKey('sentry.Group')
    actor_label = models.CharField(max_length=64, null=True, blank=True)
    # if the entry was created via a user
    actor = FlexibleForeignKey(
        'sentry.User', related_name='audit_actors', null=True, blank=True)
    # if the entry was created via an api key
    actor_key = FlexibleForeignKey('sentry.ApiKey', null=True, blank=True)
    link = BoundedPositiveIntegerField(
        default=Status.commit,
        choices=((Status.commit, _('Commit')),
                 (Status.pull, _('Pull Request')),
                 (Status.issue, _('Issue Tracker')), ),
    )
    data = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now, db_index=True)

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
