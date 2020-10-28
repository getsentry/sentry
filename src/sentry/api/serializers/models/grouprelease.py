from __future__ import absolute_import

import six

from collections import namedtuple
from datetime import timedelta
from django.utils import timezone

from sentry.app import tsdb
from sentry.api.serializers import Serializer, register, serialize
from sentry.models import GroupRelease, Release
from sentry.utils.compat import zip

StatsPeriod = namedtuple("StatsPeriod", ("segments", "interval"))


@register(GroupRelease)
class GroupReleaseSerializer(Serializer):
    def get_attrs(self, item_list, user):
        release_list = list(Release.objects.filter(id__in=[i.release_id for i in item_list]))
        releases = {r.id: d for r, d in zip(release_list, serialize(release_list, user))}

        result = {}
        for item in item_list:
            result[item] = {"release": releases.get(item.release_id)}
        return result

    def serialize(self, obj, attrs, user):
        return {
            "release": attrs["release"],
            "environment": obj.environment,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
        }


class GroupReleaseWithStatsSerializer(GroupReleaseSerializer):
    STATS_PERIODS = {
        "24h": StatsPeriod(24, timedelta(hours=1)),
        "30d": StatsPeriod(30, timedelta(hours=24)),
    }

    def __init__(self, since=None, until=None):
        self.since = since
        self.until = until

    def get_attrs(self, item_list, user):
        attrs = super(GroupReleaseWithStatsSerializer, self).get_attrs(item_list, user)

        items = {}
        for item in item_list:
            items.setdefault(item.group_id, []).append(item.id)
            attrs[item]["stats"] = {}

        for key, (segments, interval) in six.iteritems(self.STATS_PERIODS):
            until = self.until or timezone.now()
            since = self.since or until - (segments * interval)

            try:
                stats = tsdb.get_frequency_series(
                    model=tsdb.models.frequent_releases_by_group,
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
                    (k, v[item.id]) for k, v in stats.get(item.group_id, {})
                ]
        return attrs

    def serialize(self, obj, attrs, user):
        result = super(GroupReleaseWithStatsSerializer, self).serialize(obj, attrs, user)
        result["stats"] = attrs["stats"]
        return result
