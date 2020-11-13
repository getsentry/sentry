from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from enum import Enum

from sentry.db.models import (
    BoundedPositiveIntegerField,
    Model,
    FlexibleForeignKey,
    GzippedDictField,
    sane_repr,
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

    DEFAULT_CONDITION_MATCH = "all"  # any, all
    DEFAULT_FILTER_MATCH = "all"  # match to apply on filters
    DEFAULT_FREQUENCY = 30  # minutes

    project = FlexibleForeignKey("sentry.Project")
    environment_id = BoundedPositiveIntegerField(null=True)
    label = models.CharField(max_length=64)
    data = GzippedDictField()
    status = BoundedPositiveIntegerField(
        default=RuleStatus.ACTIVE,
        choices=((RuleStatus.ACTIVE, u"Active"), (RuleStatus.INACTIVE, u"Inactive")),
        db_index=True,
    )

    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=("pk",))

    class Meta:
        db_table = "sentry_rule"
        app_label = "sentry"

    __repr__ = sane_repr("project_id", "label")

    @classmethod
    def get_for_project(cls, project_id):
        cache_key = u"project:{}:rules".format(project_id)
        rules_list = cache.get(cache_key)
        if rules_list is None:
            rules_list = list(cls.objects.filter(project=project_id, status=RuleStatus.ACTIVE))
            cache.set(cache_key, rules_list, 60)
        return rules_list

    @property
    def created_by(self):
        try:
            created_activity = RuleActivity.objects.get(
                rule=self, type=RuleActivityType.CREATED.value
            )
            return created_activity.user
        except RuleActivity.DoesNotExist:
            pass

        return None

    def delete(self, *args, **kwargs):
        rv = super(Rule, self).delete(*args, **kwargs)
        cache_key = u"project:{}:rules".format(self.project_id)
        cache.delete(cache_key)
        return rv

    def save(self, *args, **kwargs):
        rv = super(Rule, self).save(*args, **kwargs)
        cache_key = u"project:{}:rules".format(self.project_id)
        cache.delete(cache_key)
        return rv

    def get_audit_log_data(self):
        return {"label": self.label, "data": self.data, "status": self.status}


class RuleActivityType(Enum):
    CREATED = 1
    DELETED = 2
    UPDATED = 3
    ENABLED = 4
    DISABLED = 5


class RuleActivity(Model):
    __core__ = True

    rule = FlexibleForeignKey("sentry.Rule")
    user = FlexibleForeignKey("sentry.User", null=True, on_delete=models.SET_NULL)
    type = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_ruleactivity"
