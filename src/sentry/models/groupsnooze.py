from datetime import timedelta

from django.db import models
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    sane_repr,
)
from sentry.utils import metrics
from sentry.utils.cache import cache


class GroupSnooze(Model):
    """
    A snooze marks an issue as ignored until a condition is hit.

    - If ``until`` is set, the snooze is lifted at the given datetime.
    - If ``count`` is set, the snooze is lifted when total occurrences match.
    - If ``window`` is set (in addition to count), the snooze is lifted when
      the rate of events matches.
    - If ``user_count`` is set, the snooze is lfited when unique users match.
    - If ``user_window`` is set (in addition to count), the snooze is lifted
      when the rate unique users matches.

    NOTE: `window` and `user_window` are specified in minutes
    """

    __include_in_export__ = False

    group = FlexibleForeignKey("sentry.Group", unique=True)
    until = models.DateTimeField(null=True)
    count = BoundedPositiveIntegerField(null=True)
    window = BoundedPositiveIntegerField(null=True)
    user_count = BoundedPositiveIntegerField(null=True)
    user_window = BoundedPositiveIntegerField(null=True)
    state = JSONField(null=True)
    actor_id = BoundedPositiveIntegerField(null=True)

    objects = BaseManager(cache_fields=("group",))

    class Meta:
        db_table = "sentry_groupsnooze"
        app_label = "sentry"

    __repr__ = sane_repr("group_id")

    @classmethod
    def get_cache_key(cls, group_id):
        return "groupsnooze_group_id:1:%s" % (group_id)

    def is_valid(self, group=None, test_rates=False):
        if group is None:
            group = self.group
        elif group.id != self.group_id:
            raise ValueError

        if self.until:
            if self.until <= timezone.now():
                return False

        if self.count:
            if self.window:
                if test_rates:
                    if not self.test_frequency_rates():
                        return False
            elif self.count <= group.times_seen - self.state["times_seen"]:
                return False

        if self.user_count and test_rates:
            if self.user_window:
                if not self.test_user_rates():
                    return False
            elif self.user_count <= group.count_users_seen() - self.state["users_seen"]:
                return False
        return True

    def test_frequency_rates(self):
        from sentry import tsdb

        metrics.incr("groupsnooze.test_frequency_rates")

        end = timezone.now()
        start = end - timedelta(minutes=self.window)

        rate = tsdb.get_sums(model=tsdb.models.group, keys=[self.group_id], start=start, end=end)[
            self.group_id
        ]
        if rate >= self.count:
            return False

        return True

    def test_user_rates(self):
        from sentry import tsdb

        metrics.incr("groupsnooze.test_user_rates")

        end = timezone.now()
        start = end - timedelta(minutes=self.user_window)

        rate = tsdb.get_distinct_counts_totals(
            model=tsdb.models.users_affected_by_group, keys=[self.group_id], start=start, end=end
        )[self.group_id]

        if rate >= self.user_count:
            return False

        return True


post_save.connect(
    lambda instance, **kwargs: cache.set(
        GroupSnooze.get_cache_key(instance.group_id), instance, 3600
    ),
    sender=GroupSnooze,
    weak=False,
)
post_delete.connect(
    lambda instance, **kwargs: cache.set(GroupSnooze.get_cache_key(instance.group_id), False, 3600),
    sender=GroupSnooze,
    weak=False,
)
