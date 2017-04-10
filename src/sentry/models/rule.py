"""
sentry.models.rule
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, Model, FlexibleForeignKey, GzippedDictField,
    sane_repr
)
from sentry.db.models.manager import BaseManager
from sentry.utils.cache import cache


# TODO(dcramer): pull in enum library
class RuleStatus(object):
    ACTIVE = 0
    INACTIVE = 1
    PENDING_DELETION = 2
    DELETION_IN_PROGRESS = 3


class Rule(Model):
    __core__ = True

    DEFAULT_ACTION_MATCH = 'all'  # any, all
    DEFAULT_FREQUENCY = 30  # minutes

    project = FlexibleForeignKey('sentry.Project')
    label = models.CharField(max_length=64)
    data = GzippedDictField()
    status = BoundedPositiveIntegerField(default=RuleStatus.ACTIVE, choices=(
        (RuleStatus.ACTIVE, 'Active'),
        (RuleStatus.INACTIVE, 'Inactive'),
    ), db_index=True)

    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=(
        'pk',
    ))

    class Meta:
        db_table = 'sentry_rule'
        app_label = 'sentry'

    __repr__ = sane_repr('project_id', 'label')

    @classmethod
    def get_for_project(cls, project_id):
        cache_key = 'project:{}:rules'.format(project_id)
        rules_list = cache.get(cache_key)
        if rules_list is None:
            rules_list = list(cls.objects.filter(
                project=project_id,
                status=RuleStatus.ACTIVE,
            ))
            cache.set(cache_key, rules_list, 60)
        return rules_list

    def delete(self, *args, **kwargs):
        rv = super(Rule, self).delete(*args, **kwargs)
        cache_key = 'project:{}:rules'.format(self.project_id)
        cache.delete(cache_key)
        return rv

    def save(self, *args, **kwargs):
        rv = super(Rule, self).save(*args, **kwargs)
        cache_key = 'project:{}:rules'.format(self.project_id)
        cache.delete(cache_key)
        return rv

    def get_audit_log_data(self):
        return {
            'label': self.label,
            'data': self.data,
            'status': self.status,
        }
