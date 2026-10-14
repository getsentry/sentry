from __future__ import annotations

from collections.abc import Iterable
from time import time

import rb
from sentry_redis_tools.clients import RedisCluster
from sentry_sdk import traces

from sentry import options
from sentry.constants import DataCategory
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.quotas.base import (
    Quota,
    QuotaConfig,
    QuotaDimension,
    QuotaGroupBy,
    QuotaScope,
)
from sentry.utils.redis import (
    get_dynamic_cluster_from_options,
    is_instance_rb_cluster,
    is_instance_redis_cluster,
    validate_dynamic_cluster,
)


class RedisQuota(Quota):
    #: The ``grace`` period allows accommodating for clock drift in TTL
    #: calculation since the clock on the Redis instance used to store quota
    #: metrics may not be in sync with the computer running this code.
    grace = 60

    def __init__(self, **options: object):
        self.is_redis_cluster, self.cluster, options = get_dynamic_cluster_from_options(
            "SENTRY_QUOTA_OPTIONS", options
        )

        # Based on the `is_redis_cluster` flag, self.cluster is set two one of
        # the following two objects:
        #  - false: `cluster` is a `RBCluster`. Call `get_local_client_for_key`
        #    on the cluster to resolve a client to run a script or query a key.
        #  - true: `cluster` is a `RedisCluster`. It automatically dispatches to
        #    the correct node and can be used as a client directly.

        super().__init__(**options)
        self.namespace = "quota"

    def validate(self) -> None:
        validate_dynamic_cluster(self.is_redis_cluster, self.cluster)

    def __get_redis_client(self, routing_key: str) -> RedisCluster | rb.RoutingClient:
        if is_instance_redis_cluster(self.cluster, self.is_redis_cluster):
            return self.cluster
        elif is_instance_rb_cluster(self.cluster, self.is_redis_cluster):
            return self.cluster.get_local_client_for_key(routing_key)
        else:
            raise AssertionError("unreachable")

    def __get_redis_key(
        self, quota: QuotaConfig, timestamp: float, shift: int, organization_id: int
    ) -> str:
        scope_id = quota.scope_id or "" if quota.scope != QuotaScope.ORGANIZATION else ""
        local_key = f"{quota.id}{{{organization_id}}}{scope_id}"
        interval = quota.window
        return f"{self.namespace}:{local_key}:{int((timestamp - shift) // interval)}"

    def get_quotas(
        self,
        project: Project,
        key: ProjectKey | None = None,
        keys: Iterable[ProjectKey] | None = None,
    ) -> list[QuotaConfig]:
        if key:
            key.project = project

        results = [*self.get_abuse_quotas(project.organization)]

        with traces.start_span(
            name="redis.get_quotas.get_monitor_quota",
            attributes={
                "sentry.op": "redis.get_quotas.get_monitor_quota",
                "project.id": project.id,
            },
        ):
            mrlquota = self.get_monitor_quota(project)
            if mrlquota[0] is not None:
                results.append(
                    QuotaConfig(
                        id="mrl",
                        limit=mrlquota[0],
                        window=mrlquota[1],
                        scope=QuotaScope.PROJECT,
                        scope_id=project.id,
                        categories=[DataCategory.MONITOR],
                        reason_code="monitor_rate_limit",
                    )
                )

        if options.get("crons.per_monitor_relay_quota.enabled"):
            from sentry.monitors.rate_limit import PER_MONITOR_MAX_CARDINALITY, QUOTA_WINDOW

            results.append(
                QuotaConfig(
                    id="mrl_env",
                    limit=options.get("crons.per_monitor_rate_limit"),
                    window=QUOTA_WINDOW,
                    scope=QuotaScope.PROJECT,
                    scope_id=project.id,
                    categories=[DataCategory.MONITOR],
                    reason_code="monitor_env_rate_limit",
                    group_by=QuotaGroupBy(
                        max_cardinality=PER_MONITOR_MAX_CARDINALITY,
                        dimensions=(
                            QuotaDimension.CHECK_IN_SLUG,
                            QuotaDimension.CHECK_IN_ENVIRONMENT,
                        ),
                    ),
                )
            )

        if key and not keys:
            keys = [key]
        elif not keys:
            keys = []

        for key in keys:
            with traces.start_span(
                name="redis.get_quotas.get_key_quota",
                attributes={
                    "sentry.op": "redis.get_quotas.get_key_quota",
                    "key.id": key.id,
                },
            ):
                kquota = self.get_key_quota(key)
                if kquota[0] is not None:
                    results.append(
                        QuotaConfig(
                            id="k",
                            scope=QuotaScope.KEY,
                            scope_id=key.id,
                            categories=DataCategory.error_categories(),
                            limit=kquota[0],
                            window=kquota[1],
                            reason_code="key_quota",
                        )
                    )

        return results

    def get_refunded_quota_key(self, key: str) -> str:
        return f"r:{key}"

    @traces.trace
    def refund(
        self,
        project: Project,
        key: ProjectKey | None = None,
        timestamp: float | None = None,
        category: DataCategory | None = None,
        quantity: int | None = None,
    ) -> None:
        if timestamp is None:
            timestamp = time()

        if category is None:
            category = DataCategory.ERROR

        if quantity is None:
            quantity = 1

        # only refund quotas that can be tracked and that specify the given
        # category. an empty categories list usually refers to all categories,
        # but such quotas are invalid with counters.
        quotas = [
            quota
            for quota in self.get_quotas(project, key=key)
            if quota.should_track and category in quota.categories
        ]

        if not quotas:
            return

        client = self.__get_redis_client(str(project.organization_id))
        pipe = client.pipeline()

        for quota in quotas:
            shift = project.organization_id % quota.window
            # kind of arbitrary, but seems like we don't want this to expire til we're
            # sure the window is over?
            expiry = self.get_next_period_start(quota.window, shift, timestamp) + self.grace
            return_key = self.get_refunded_quota_key(
                self.__get_redis_key(quota, timestamp, shift, project.organization_id)
            )
            pipe.incr(return_key, quantity)
            pipe.expireat(return_key, int(expiry))

        pipe.execute()

    def get_next_period_start(self, interval: int, shift: int, timestamp: float) -> float:
        """Return the timestamp when the next rate limit period begins for an interval."""
        return (((timestamp - shift) // interval) + 1) * interval + shift
