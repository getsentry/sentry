import functools
from time import time

from sentry.constants import DataCategory
from sentry.quotas.base import Quota, QuotaConfig, QuotaScope
from sentry.utils.redis import get_dynamic_cluster_from_options, validate_dynamic_cluster


class RedisQuota(Quota):
    #: The ``grace`` period allows accommodating for clock drift in TTL
    #: calculation since the clock on the Redis instance used to store quota
    #: metrics may not be in sync with the computer running this code.
    grace = 60

    def __init__(self, **options):
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

    def validate(self):
        validate_dynamic_cluster(self.is_redis_cluster, self.cluster)

    def __get_redis_client(self, routing_key):
        if self.is_redis_cluster:
            return self.cluster
        else:
            return self.cluster.get_local_client_for_key(routing_key)

    def __get_redis_key(self, quota, timestamp, shift, organization_id):
        if self.is_redis_cluster:
            scope_id = quota.scope_id or "" if quota.scope != QuotaScope.ORGANIZATION else ""
            # new style redis cluster format which always has the organization id in
            local_key = f"{quota.id}{{{organization_id}}}{scope_id}"
        else:
            # legacy key format
            local_key = f"{quota.id}:{quota.scope_id or organization_id}"

        interval = quota.window
        return f"{self.namespace}:{local_key}:{int((timestamp - shift) // interval)}"

    def get_quotas(self, project, key=None, keys=None):
        if key:
            key.project = project

        results = []

        pquota = self.get_project_quota(project)
        if pquota[0] is not None:
            results.append(
                QuotaConfig(
                    id="p",
                    scope=QuotaScope.PROJECT,
                    scope_id=project.id,
                    categories=DataCategory.error_categories(),
                    limit=pquota[0],
                    window=pquota[1],
                    reason_code="project_quota",
                )
            )

        oquota = self.get_organization_quota(project.organization)
        if oquota[0] is not None:
            results.append(
                QuotaConfig(
                    id="o",
                    scope=QuotaScope.ORGANIZATION,
                    scope_id=project.organization.id,
                    categories=DataCategory.error_categories(),
                    limit=oquota[0],
                    window=oquota[1],
                    reason_code="org_quota",
                )
            )

        if key and not keys:
            keys = [key]
        elif not keys:
            keys = []

        for key in keys:
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

    def get_usage(self, organization_id, quotas, timestamp=None):
        if timestamp is None:
            timestamp = time()

        def get_usage_for_quota(client, quota):
            if not quota.should_track:
                return (None, None)

            key = self.__get_redis_key(
                quota, timestamp, organization_id % quota.window, organization_id
            )
            refund_key = self.get_refunded_quota_key(key)

            return (client.get(key), client.get(refund_key))

        def get_value_for_result(result, refund_result):
            if result is None:
                return None

            return int(result.value or 0) - int(refund_result.value or 0)

        if self.is_redis_cluster:
            results = map(functools.partial(get_usage_for_quota, self.cluster), quotas)
        else:
            with self.cluster.fanout() as client:
                results = map(
                    functools.partial(get_usage_for_quota, client.target_key(str(organization_id))),
                    quotas,
                )

        return [get_value_for_result(*r) for r in results]

    def get_refunded_quota_key(self, key):
        return f"r:{key}"

    def refund(self, project, key=None, timestamp=None, category=None, quantity=None):
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

    def get_next_period_start(self, interval, shift, timestamp):
        """Return the timestamp when the next rate limit period begins for an interval."""
        return (((timestamp - shift) // interval) + 1) * interval + shift
