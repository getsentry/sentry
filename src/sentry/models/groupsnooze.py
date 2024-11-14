from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING, Any, ClassVar, Self

from django.db import models
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry import tsdb
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.issues.constants import get_issue_tsdb_group_model, get_issue_tsdb_user_group_model
from sentry.snuba.referrer import Referrer
from sentry.utils import metrics
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.group import Group


@region_silo_model
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

    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group", unique=True)
    until = models.DateTimeField(null=True)
    count = BoundedPositiveIntegerField(null=True)
    window = BoundedPositiveIntegerField(null=True)
    user_count = BoundedPositiveIntegerField(null=True)
    user_window = BoundedPositiveIntegerField(null=True)
    state: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    actor_id = BoundedPositiveIntegerField(null=True)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("group",))

    class Meta:
        db_table = "sentry_groupsnooze"
        app_label = "sentry"

    __repr__ = sane_repr("group_id")

    @classmethod
    def get_cache_key(cls, group_id: int) -> str:
        return f"groupsnooze_group_id:1:{group_id}"

    def is_valid(
        self, group: Group | None = None, test_rates: bool = False, use_pending_data: bool = False
    ) -> bool:
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
            else:
                times_seen = group.times_seen_with_pending if use_pending_data else group.times_seen
                assert self.state is not None
                if self.count <= times_seen - self.state["times_seen"]:
                    return False

        if self.user_count and test_rates:
            if not self.test_user_rates_or_counts(group):
                return False

        return True

    def test_frequency_rates(self) -> bool:
        cache_key = f"groupsnooze:v1:{self.id}:test_frequency_rate:events_seen_counter"

        cache_ttl = self.window * 60  # Redis TTL in seconds (window is in minutes)

        cached_event_count: int | float = float("inf")  # using +inf as a sentinel value

        try:
            cached_event_count = cache.incr(cache_key)
            cache.touch(cache_key, cache_ttl)
        except ValueError:
            # key doesn't exist, fall back on sentinel value
            pass

        if cached_event_count < self.count:
            metrics.incr("groupsnooze.test_frequency_rates", tags={"cached": "true", "hit": "true"})
            return True

        metrics.incr("groupsnooze.test_frequency_rates", tags={"cached": "true", "hit": "false"})
        metrics.incr("groupsnooze.test_frequency_rates.snuba_call")
        end = timezone.now()
        start = end - timedelta(minutes=self.window)

        rate = tsdb.backend.get_sums(
            model=get_issue_tsdb_group_model(self.group.issue_category),
            keys=[self.group_id],
            start=start,
            end=end,
            tenant_ids={"organization_id": self.group.project.organization_id},
            referrer_suffix="frequency_snoozes",
        )[self.group_id]

        # TTL is further into the future than it needs to be, but we'd rather over-estimate
        # and call Snuba more often than under-estimate and not trigger
        cache.set(cache_key, rate, cache_ttl)

        if rate >= self.count:
            return False

        return True

    def test_user_rates_or_counts(self, group: Group) -> bool:
        """
        Test if the number of unique users or rate of users seen by the group is below the snooze threshold.
        Returns: True if below threshold, False otherwise.

        - Non-cached version of the function queries Snuba for the real count every time.
        - Cached version uses Redis counters to store the number of events seen since last check,
          if it's less than the number of users needed to reach the threshold, we can be sure
          that we couldn't have reach enough users to reach the threshold, so there's no need
          to query Snuba. This functionality relies on the fact that this is called in
          post-processing for every event, so we can assume that the call-count == event count.
        """
        if self.user_window:
            if not self.test_user_rates():
                return False
        elif not self.test_user_counts(group):
            return False
        return True

    def test_user_rates(self) -> bool:
        cache_key = f"groupsnooze:v1:{self.id}:test_user_rate:events_seen_counter"

        cache_ttl = self.user_window * 60  # Redis TTL in seconds (window is in minutes)

        cached_event_count: int | float = float("inf")  # using +inf as a sentinel value

        try:
            cached_event_count = cache.incr(cache_key)
            cache.touch(cache_key, cache_ttl)
        except ValueError:
            # key doesn't exist, fall back on sentinel value
            pass

        if cached_event_count < self.user_count:
            # if number of hits within the window is less than the threshold, we can't have reached enough users
            metrics.incr("groupsnooze.test_user_rates", tags={"cached": "true", "hit": "true"})
            return True

        metrics.incr("groupsnooze.test_user_rates", tags={"cached": "true", "hit": "false"})
        metrics.incr("groupsnooze.test_user_rates.snuba_call")
        end = timezone.now()
        start = end - timedelta(minutes=self.user_window)

        rate = tsdb.backend.get_distinct_counts_totals(
            model=get_issue_tsdb_user_group_model(self.group.issue_category),
            keys=[self.group_id],
            start=start,
            end=end,
            tenant_ids={"organization_id": self.group.project.organization_id},
            referrer_suffix="user_count_snoozes",
        )[self.group_id]

        # TTL is further into the future than it needs to be, but we'd rather over-estimate
        # and call Snuba more often than under-estimate and not trigger
        cache.set(cache_key, rate, cache_ttl)

        if rate >= self.user_count:
            return False

        return True

    def test_user_counts(self, group: Group) -> bool:
        cache_key = f"groupsnooze:v1:{self.id}:test_user_counts:events_seen_counter"
        if self.state is None:
            users_seen = 0
        else:
            users_seen = self.state.get("users_seen", 0)

        threshold = self.user_count + users_seen

        CACHE_TTL = 3600  # Redis TTL in seconds

        cached_event_count: int | float = float("inf")  # using +inf as a sentinel value
        try:
            cached_event_count = cache.incr(cache_key)
        except ValueError:
            # key doesn't exist, fall back on sentinel value
            pass

        if cached_event_count < threshold:
            # if we've seen less than that many events, we can't possibly have seen enough users
            metrics.incr("groupsnooze.test_user_counts", tags={"cached": "true", "hit": "true"})
            return True

        metrics.incr("groupsnooze.test_user_counts", tags={"cached": "true", "hit": "false"})
        metrics.incr("groupsnooze.test_user_counts.snuba_call")
        real_count = group.count_users_seen(
            referrer=Referrer.TAGSTORE_GET_GROUPS_USER_COUNTS_GROUP_SNOOZE.value
        )
        cache.set(cache_key, real_count, CACHE_TTL)
        return real_count < threshold


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
