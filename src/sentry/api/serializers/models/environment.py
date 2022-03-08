from collections import namedtuple
from datetime import timedelta
from typing import List

from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.app import tsdb
from sentry.models import Environment, EnvironmentBookmark, EnvironmentProject, User

StatsPeriod = namedtuple("StatsPeriod", ("segments", "interval"))


def get_bookmarks(env_list: List[Environment], user: User):
    """
    Gets a list of environment id's which are bookmarked by the user
    """
    if not user.is_authenticated or not env_list:
        return set()

    return set(
        EnvironmentBookmark.objects.filter(
            user=user, environment_id__in=[i.id for i in env_list]
        ).values_list("environment_id", flat=True)
    )


@register(Environment)
class EnvironmentSerializer(Serializer):
    def get_attrs(self, item_list, user):
        bookmarks = get_bookmarks(item_list, user)
        return {item: {"is_bookmarked": item.id in bookmarks} for item in item_list}

    def serialize(self, obj, attrs, user):
        return {"id": str(obj.id), "name": obj.name, "isBookmarked": attrs["is_bookmarked"]}


@register(EnvironmentProject)
class EnvironmentProjectSerializer(Serializer):
    def get_attrs(self, item_list, user):
        bookmarks = get_bookmarks(item_list, user)
        return {item: {"is_bookmarked": item.id in bookmarks} for item in item_list}

    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "name": obj.environment.name,
            "isHidden": obj.is_hidden is True,
            "isBookmarked": attrs["is_bookmarked"],
        }


class GroupEnvironmentWithStatsSerializer(EnvironmentSerializer):
    STATS_PERIODS = {
        "24h": StatsPeriod(24, timedelta(hours=1)),
        "30d": StatsPeriod(30, timedelta(hours=24)),
    }

    def __init__(self, group, since=None, until=None):
        self.group = group
        self.since = since
        self.until = until

    def get_attrs(self, item_list, user):
        attrs = {item: {"stats": {}} for item in item_list}
        items = {self.group.id: []}
        for item in item_list:
            items[self.group.id].append(item.id)

        for key, (segments, interval) in self.STATS_PERIODS.items():
            until = self.until or timezone.now()
            since = self.since or until - (segments * interval)

            try:
                stats = tsdb.get_frequency_series(
                    model=tsdb.models.frequent_environments_by_group,
                    items=items,
                    start=since,
                    end=until,
                    rollup=int(interval.total_seconds()),
                )
            except NotImplementedError:
                # TODO(dcramer): probably should log this, but not worth
                # erring out
                stats = {}

            for item in item_list:
                attrs[item]["stats"][key] = [
                    (k, v[item.id]) for k, v in stats.get(self.group.id, {})
                ]
        return attrs

    def serialize(self, obj, attrs, user):
        result = super().serialize(obj, attrs, user)
        result["stats"] = attrs["stats"]
        return result
