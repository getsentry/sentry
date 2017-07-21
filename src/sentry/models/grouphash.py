"""
sentry.models.grouphash
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
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
    def fetch_last_processed_event_id(project_id, group_hash_ids):
        prefix = 'last-processed-event:{}'.format(project_id)
        with redis.clusters.get('default').map() as client:
            results = map(
                lambda group_hash_id: client.hget(
                    '{}:{}'.format(prefix, group_hash_id % 16),
                    group_hash_id,
                ),
                group_hash_ids,
            )

        return map(
            lambda result: result.value,
            results,
        )

    @staticmethod
    def record_last_processed_event_id(project_id, group_hash_ids, event_id):
        prefix = 'last-processed-event:{}'.format(project_id)
        with redis.clusters.get('default').map() as client:
            results = map(
                lambda group_hash_id: client.hset(
                    '{}:{}'.format(prefix, group_hash_id % 16),
                    group_hash_id,
                    event_id,
                ),
                group_hash_ids,
            )

        return map(
            lambda result: result.value,
            results,
        )
