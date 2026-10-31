from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import NamedTuple, TypedDict, cast

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from sentry import tsdb
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.types import ReleaseSerializerResponse
from sentry.models.grouprelease import GroupRelease
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.tsdb.base import TSDBModel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class StatsPeriod(NamedTuple):
    segments: int
    interval: timedelta


class GroupReleaseSerializerResponse(TypedDict):
    release: ReleaseSerializerResponse | None
    environment: str
    firstSeen: datetime
    lastSeen: datetime


class GroupReleaseWithStatsSerializerResponse(GroupReleaseSerializerResponse):
    stats: dict[str, list[tuple[float, float]]]


@register(GroupRelease)
class GroupReleaseSerializer(Serializer[GroupReleaseSerializerResponse]):
    def get_attrs(
        self,
        item_list: Sequence[GroupRelease],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[GroupRelease, dict[str, object]]:
        release_list = list(Release.objects.filter(id__in=[i.release_id for i in item_list]))
        releases = {r.id: d for r, d in zip(release_list, serialize(release_list, user))}

        result: dict[GroupRelease, dict[str, object]] = {}
        for item in item_list:
            result[item] = {"release": releases.get(item.release_id)}
        return result

    def serialize(
        self,
        obj: GroupRelease,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> GroupReleaseSerializerResponse:
        return {
            "release": cast(ReleaseSerializerResponse | None, attrs["release"]),
            "environment": obj.environment,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
        }


class GroupReleaseWithStatsSerializer(GroupReleaseSerializer):
    STATS_PERIODS = {
        "24h": StatsPeriod(24, timedelta(hours=1)),
        "30d": StatsPeriod(30, timedelta(hours=24)),
    }

    def __init__(self, since: datetime | None = None, until: datetime | None = None) -> None:
        self.since = since
        self.until = until

    def get_attrs(
        self,
        item_list: Sequence[GroupRelease],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[GroupRelease, dict[str, object]]:
        attrs = super().get_attrs(item_list, user)

        tenant_ids = (
            {
                "organization_id": Project.objects.get_from_cache(
                    id=item_list[0].project_id
                ).organization_id
            }
            if item_list
            else None
        )

        items: dict[int, list[int]] = {}
        for item in item_list:
            items.setdefault(item.group_id, []).append(item.id)
            attrs[item]["stats"] = {}

        for key, (segments, interval) in self.STATS_PERIODS.items():
            until = self.until or timezone.now()
            since = self.since or until - (segments * interval)

            try:
                stats = tsdb.backend.get_frequency_series(
                    model=TSDBModel.frequent_releases_by_group,
                    items=items,
                    start=since,
                    end=until,
                    rollup=int(interval.total_seconds()),
                    tenant_ids=tenant_ids,
                )
            except NotImplementedError:
                # TODO(dcramer): probably should log this, but not worth
                # erring out
                stats = {}

            for item in item_list:
                item_stats = cast(dict[str, object], attrs[item]["stats"])
                item_stats[key] = [(k, v[item.id]) for k, v in stats.get(item.group_id, {})]
        return attrs

    def serialize(
        self,
        obj: GroupRelease,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> GroupReleaseWithStatsSerializerResponse:
        result = cast(GroupReleaseWithStatsSerializerResponse, super().serialize(obj, attrs, user))
        result["stats"] = cast(dict[str, list[tuple[float, float]]], attrs["stats"])
        return result
