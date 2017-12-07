"""
sentry.models.grouphash
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.db.models.signals import post_delete
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model
from sentry.utils import redis


class GroupHash(Model):
    __core__ = False

    class State:
        UNLOCKED = None
        LOCKED_IN_MIGRATION = 1

    project = FlexibleForeignKey('sentry.Project', null=True)
    hash = models.CharField(max_length=32)
    group = FlexibleForeignKey('sentry.Group', null=True)
    group_tombstone_id = BoundedPositiveIntegerField(db_index=True, null=True)
    state = BoundedPositiveIntegerField(
        choices=[
            (State.LOCKED_IN_MIGRATION, _('Locked (Migration in Progress)')),
        ],
        null=True,
    )

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_grouphash'
        unique_together = (('project', 'hash'), )

    @staticmethod
    def fetch_last_processed_event_id(group_hash_ids):
        with redis.clusters.get('default').map() as client:
            results = [client.get('gh:lp:{}'.format(id)) for id in group_hash_ids]
        return [result.value for result in results]

    @staticmethod
    def record_last_processed_event_id(group_hash_id, event_id):
        with redis.clusters.get('default').map() as client:
            key = 'gh:lp:{}'.format(group_hash_id)
            client.set(key, '{}'.format(event_id))
            client.expire(key, 7776000)  # 90d

    @staticmethod
    def delete_last_processed_event_id(group_hash_id):
        with redis.clusters.get('default').map() as client:
            client.delete('gh:lp:{}'.format(group_hash_id))


post_delete.connect(
    lambda instance, **kwargs: GroupHash.delete_last_processed_event_id(instance.id),
    sender=GroupHash,
    weak=False,
)
