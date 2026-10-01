import time
from collections.abc import Generator
from functools import cached_property
from unittest import mock

import pytest

from sentry.constants import DataCategory
from sentry.quotas.base import (
    QuotaConfig,
    QuotaDimension,
    QuotaGroupBy,
    QuotaScope,
    build_metric_abuse_quotas,
)
from sentry.quotas.redis import RedisQuota, is_rate_limited
from sentry.sentry_metrics.use_case_id_registry import CARDINALITY_LIMIT_USE_CASES, UseCaseID
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.redis import use_redis_cluster
from sentry.utils.redis import clusters, redis_clusters


def test_is_rate_limited_script() -> None:
    now = int(time.time())

    cluster = clusters.get("default")
    client = cluster.get_local_client(next(iter(cluster.hosts)))

    # The item should not be rate limited by either key.
    assert list(
        map(
            bool,
            is_rate_limited(("foo", "r:foo", "bar", "r:bar"), (1, now + 60, 2, now + 120), client),
        )
    ) == [False, False]

    # The item should be rate limited by the first key (1).
    assert list(
        map(
            bool,
            is_rate_limited(("foo", "r:foo", "bar", "r:bar"), (1, now + 60, 2, now + 120), client),
        )
    ) == [True, False]

    # The item should still be rate limited by the first key (1), but *not*
    # rate limited by the second key (2) even though this is the third time
    # we've checked the quotas. This ensures items that are rejected by a lower
    # quota don't affect unrelated items that share a parent quota.
    assert list(
        map(
            bool,
            is_rate_limited(("foo", "r:foo", "bar", "r:bar"), (1, now + 60, 2, now + 120), client),
        )
    ) == [True, False]

    assert client.get("foo") == b"1"
    assert 59 <= client.ttl("foo") <= 60

    assert client.get("bar") == b"1"
    assert 119 <= client.ttl("bar") <= 120

    # make sure "refund/negative" keys haven't been incremented
    assert client.get("r:foo") is None
    assert client.get("r:bar") is None

    # Test that refunded quotas work
    client.set("apple", 5)
    # increment
    is_rate_limited(("orange", "baz"), (1, now + 60), client)
    # test that it's rate limited without refund
    assert list(map(bool, is_rate_limited(("orange", "baz"), (1, now + 60), client))) == [True]
    # test that refund key is used
    assert list(map(bool, is_rate_limited(("orange", "apple"), (1, now + 60), client))) == [False]


class RedisQuotaTest(TestCase):
    @cached_property
    def quota(self):
        return RedisQuota()

    def test_redis_quota_serialize(self) -> None:
        assert QuotaScope.ORGANIZATION.api_name() == "organization"
        assert QuotaScope.PROJECT.api_name() == "project"
        assert QuotaScope.KEY.api_name() == "key"

    def test_abuse_quotas(self) -> None:
        # These legacy options need to be set, otherwise we'll run into
        # AssertionError: reject-all quotas cannot be tracked
        self.get_monitor_quota.return_value = (15, 60)

        # A negative quota means reject-all.
        self.organization.update_option("project-abuse-quota.error-limit", -1)
        quotas = self.quota.get_quotas(self.project)

        assert quotas[0].id is None
        assert quotas[0].scope == QuotaScope.PROJECT
        assert quotas[0].scope_id is None
        assert quotas[0].categories == {
            DataCategory.DEFAULT,
            DataCategory.ERROR,
            DataCategory.SECURITY,
        }
        assert quotas[0].limit == 0
        assert quotas[0].window is None
        assert quotas[0].reason_code == "disabled"

        self.organization.update_option("project-abuse-quota.error-limit", 42)
        quotas = self.quota.get_quotas(self.project)

        assert quotas[0].id == "pae"
        assert quotas[0].scope == QuotaScope.PROJECT
        assert quotas[0].scope_id is None
        assert quotas[0].categories == {
            DataCategory.DEFAULT,
            DataCategory.ERROR,
            DataCategory.SECURITY,
        }
        assert quotas[0].limit == 420
        assert quotas[0].window == 10
        assert quotas[0].reason_code == "project_abuse_limit"

        self.organization.update_option("project-abuse-quota.attachment-limit", 601)
        self.organization.update_option("project-abuse-quota.attachment-item-limit", 6010)
        self.organization.update_option("project-abuse-quota.session-limit", 602)
        self.organization.update_option("organization-abuse-quota.metric-bucket-limit", 603)

        metric_abuse_limit_by_id = dict()
        for i, mabq in enumerate(build_metric_abuse_quotas()):
            self.organization.update_option(mabq.option, 700 + i)
            metric_abuse_limit_by_id[mabq.id] = 700 + i

        with self.feature("organizations:transaction-metrics-extraction"):
            quotas = self.quota.get_quotas(self.project)

        assert quotas[1].id == "paa"
        assert quotas[1].scope == QuotaScope.PROJECT
        assert quotas[1].scope_id is None
        assert quotas[1].categories == {DataCategory.ATTACHMENT}
        assert quotas[1].limit == 6010
        assert quotas[1].window == 10
        assert quotas[1].reason_code == "project_abuse_limit"

        assert quotas[2].id == "paai"
        assert quotas[2].scope == QuotaScope.PROJECT
        assert quotas[2].scope_id is None
        assert quotas[2].categories == {DataCategory.ATTACHMENT_ITEM}
        assert quotas[2].limit == 60100
        assert quotas[2].window == 10
        assert quotas[2].reason_code == "project_abuse_limit"

        assert quotas[3].id == "pas"
        assert quotas[3].scope == QuotaScope.PROJECT
        assert quotas[3].scope_id is None
        assert quotas[3].categories == {DataCategory.SESSION}
        assert quotas[3].limit == 6020
        assert quotas[3].window == 10
        assert quotas[3].reason_code == "project_abuse_limit"

        expected_quotas: dict[tuple[QuotaScope, UseCaseID | None], str] = dict()
        for scope, prefix in [
            (QuotaScope.PROJECT, "p"),
            (QuotaScope.ORGANIZATION, "o"),
        ]:
            expected_quotas[(scope, None)] = f"{prefix}amb"
            for use_case in CARDINALITY_LIMIT_USE_CASES:
                expected_quotas[(scope, use_case)] = f"{prefix}amb_{use_case.value}"

        for (expected_scope, expected_use_case), id in expected_quotas.items():
            quota = next(x for x in quotas if x.id == id)
            assert quota is not None

            assert quota.id == id
            assert quota.scope == expected_scope
            assert quota.scope_id is None
            assert quota.categories == {DataCategory.METRIC_BUCKET}
            assert quota.limit == metric_abuse_limit_by_id[id] * 10
            if expected_use_case is None:
                assert quota.namespace is None
            else:
                assert quota.namespace == expected_use_case.value
            assert quota.window == 10
            if expected_scope == QuotaScope.ORGANIZATION:
                assert quota.reason_code == "org_abuse_limit"
            elif expected_scope == QuotaScope.PROJECT:
                assert quota.reason_code == "project_abuse_limit"
            else:
                assert False, "invalid quota scope"

        # Let's set the global option for error limits.
        # Since we already have an org override for it, it shouldn't change anything.
        with self.options({"project-abuse-quota.error-limit": 3}):
            quotas = self.quota.get_quotas(self.project)

        assert quotas[0].id == "pae"
        assert quotas[0].limit == 420
        assert quotas[0].window == 10

        # Let's make the org override unlimited.
        # The global option should kick in.
        self.organization.update_option("project-abuse-quota.error-limit", 0)
        with self.options({"project-abuse-quota.error-limit": 3}):
            quotas = self.quota.get_quotas(self.project)

        assert quotas[0].id == "pae"
        assert quotas[0].limit == 30
        assert quotas[0].window == 10

        # Compatibility: preserve previous getsentry behavior.

        # Let's update the deprecated global setting.
        # It should take precedence over both the new global option and its org override.
        with self.options({"getsentry.rate-limit.project-errors": 1}):
            quotas = self.quota.get_quotas(self.project)

        assert quotas[0].id == "pae"
        assert quotas[0].scope == QuotaScope.PROJECT
        assert quotas[0].scope_id is None
        assert quotas[0].categories == {
            DataCategory.DEFAULT,
            DataCategory.ERROR,
            DataCategory.SECURITY,
        }
        assert quotas[0].limit == 10
        assert quotas[0].window == 10
        assert quotas[0].reason_code == "project_abuse_limit"

        # Let's set the deprecated override for that.
        self.organization.update_option("sentry:project-error-limit", 2)
        # Also, let's change the global abuse window.
        with self.options({"project-abuse-quota.window": 20}):
            quotas = self.quota.get_quotas(self.project)

        assert quotas[0].id == "pae"
        assert quotas[0].scope == QuotaScope.PROJECT
        assert quotas[0].scope_id is None
        assert quotas[0].categories == {
            DataCategory.DEFAULT,
            DataCategory.ERROR,
            DataCategory.SECURITY,
        }
        assert quotas[0].limit == 40
        assert quotas[0].window == 20
        assert quotas[0].reason_code == "project_abuse_limit"

    @pytest.fixture(autouse=True)
    def _patch_get_monitor_quota(self) -> Generator[None]:
        with mock.patch.object(
            RedisQuota, "get_monitor_quota", return_value=(0, 60)
        ) as self.get_monitor_quota:
            yield

    def test_uses_defined_quotas(self) -> None:
        self.get_monitor_quota.return_value = (15, 60)
        quotas = self.quota.get_quotas(self.project)

        assert quotas[0].id == "mrl"
        assert quotas[0].scope == QuotaScope.PROJECT
        assert quotas[0].scope_id == str(self.project.id)
        assert quotas[0].limit == 15
        assert quotas[0].window == 60

    def test_per_monitor_quota_disabled(self) -> None:
        self.get_monitor_quota.return_value = (15, 60)
        quotas = self.quota.get_quotas(self.project)
        assert not any(q.id == "mrl_env" for q in quotas)

    @override_options(
        {"crons.per_monitor_relay_quota.enabled": True, "crons.per_monitor_rate_limit": 6}
    )
    def test_per_monitor_quota(self) -> None:
        self.get_monitor_quota.return_value = (15, 60)
        quotas = self.quota.get_quotas(self.project)

        quota = next(q for q in quotas if q.id == "mrl_env")
        assert quota.scope == QuotaScope.PROJECT
        assert quota.scope_id == str(self.project.id)
        assert quota.categories == {DataCategory.MONITOR}
        assert quota.limit == 6
        assert quota.window == 60
        assert quota.reason_code == "monitor_rate_limit"
        assert quota.group_by == QuotaGroupBy(
            max_cardinality=2000,
            dimensions=(QuotaDimension.CHECK_IN_SLUG, QuotaDimension.CHECK_IN_ENVIRONMENT),
        )
        # The project-wide monitor quota is still sent.
        assert any(q.id == "mrl" for q in quotas)

    @mock.patch("sentry.quotas.redis.is_rate_limited")
    @mock.patch.object(RedisQuota, "get_quotas", return_value=[])
    def test_bails_immediately_without_any_quota(
        self, get_quotas: mock.MagicMock, is_rate_limited: mock.MagicMock
    ) -> None:
        result = self.quota.is_rate_limited(self.project)
        assert not is_rate_limited.called
        assert not result.is_limited

    @mock.patch.object(RedisQuota, "get_quotas")
    @mock.patch("sentry.quotas.redis.is_rate_limited", return_value=(False, False))
    def test_not_limited_with_unlimited_quota(
        self, mock_is_rate_limited: mock.MagicMock, mock_get_quotas: mock.MagicMock
    ) -> None:
        mock_get_quotas.return_value = (
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=1,
                limit=None,
                window=1,
                reason_code="project_quota",
            ),
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=2,
                limit=1,
                window=1,
                reason_code="project_quota",
            ),
        )

        assert not self.quota.is_rate_limited(self.project).is_limited

    @mock.patch.object(RedisQuota, "get_quotas")
    @mock.patch("sentry.quotas.redis.is_rate_limited", return_value=(False, True))
    def test_limited_with_unlimited_quota(
        self, mock_is_rate_limited: mock.MagicMock, mock_get_quotas: mock.MagicMock
    ) -> None:
        mock_get_quotas.return_value = (
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=1,
                limit=None,
                window=1,
                reason_code="project_quota",
            ),
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=2,
                limit=1,
                window=1,
                reason_code="project_quota",
            ),
        )

        assert self.quota.is_rate_limited(self.project).is_limited

    @mock.patch.object(RedisQuota, "get_quotas")
    def test_refund_defaults(self, mock_get_quotas: mock.MagicMock) -> None:
        timestamp = time.time()

        mock_get_quotas.return_value = (
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=1,
                limit=None,
                window=1,
                reason_code="project_quota",
                categories=[DataCategory.ERROR],
            ),
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=2,
                limit=1,
                window=1,
                reason_code="project_quota",
                categories=[DataCategory.ERROR],
            ),
            # Should be ignored
            QuotaConfig(
                id="a",
                scope=QuotaScope.PROJECT,
                scope_id=1,
                limit=1**6,
                window=1,
                reason_code="attachment_quota",
                categories=[DataCategory.ATTACHMENT],
            ),
        )

        org_id = self.project.organization.pk
        self.quota.refund(self.project, timestamp=timestamp)
        client = self.quota.cluster.get_local_client_for_key(str(self.project.organization.pk))

        error_keys = client.keys(f"r:quota:p{{{org_id}}}*:*")
        assert len(error_keys) == 2

        for key in error_keys:
            assert client.get(key) == b"1"

        attachment_keys = client.keys(f"r:quota:a{{{org_id}}}*:*")
        assert len(attachment_keys) == 0

    @mock.patch.object(RedisQuota, "get_quotas")
    def test_refund_categories(self, mock_get_quotas: mock.MagicMock) -> None:
        timestamp = time.time()

        mock_get_quotas.return_value = (
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=1,
                limit=None,
                window=1,
                reason_code="project_quota",
                categories=[DataCategory.ERROR],
            ),
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=2,
                limit=1,
                window=1,
                reason_code="project_quota",
                categories=[DataCategory.ERROR],
            ),
            # Should be ignored
            QuotaConfig(
                id="a",
                scope=QuotaScope.PROJECT,
                scope_id=1,
                limit=1**6,
                window=1,
                reason_code="attachment_quota",
                categories=[DataCategory.ATTACHMENT],
            ),
        )

        org_id = self.project.organization.pk
        self.quota.refund(
            self.project, timestamp=timestamp, category=DataCategory.ATTACHMENT, quantity=100
        )
        client = self.quota.cluster.get_local_client_for_key(str(self.project.organization.pk))

        error_keys = client.keys(f"r:quota:p{{{org_id}}}*:*")
        assert len(error_keys) == 0

        attachment_keys = client.keys(f"r:quota:a{{{org_id}}}1:*")
        assert len(attachment_keys) == 1

        for key in attachment_keys:
            assert client.get(key) == b"100"


@pytest.mark.usefixtures("_redis_cluster")
class RedisClusterQuotaTest(TestCase):
    @pytest.fixture
    def _redis_cluster(self) -> Generator[None]:
        with use_redis_cluster("quotas"):
            self.quota.cluster.flushall()
            yield
            redis_clusters._clusters_str.pop("quotas", None)

    @cached_property
    def quota(self) -> RedisQuota:
        return RedisQuota(cluster="quotas")

    @mock.patch.object(RedisQuota, "get_quotas")
    def test_is_rate_limited_refund_and_get_usage(self, mock_get_quotas: mock.MagicMock) -> None:
        quotas = [
            QuotaConfig(
                id="o",
                scope=QuotaScope.ORGANIZATION,
                limit=2,
                window=60,
                reason_code="org_quota",
                categories=[DataCategory.ERROR],
            ),
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=self.project.id,
                limit=None,
                window=60,
                reason_code="project_quota",
                categories=[DataCategory.ERROR],
            ),
        ]
        mock_get_quotas.return_value = quotas
        org_id = self.project.organization_id
        timestamp = time.time()

        assert self.quota.get_usage(org_id, quotas, timestamp=timestamp) == [0, 0]
        assert not self.quota.is_rate_limited(self.project, timestamp=timestamp).is_limited
        assert not self.quota.is_rate_limited(self.project, timestamp=timestamp).is_limited
        assert self.quota.is_rate_limited(self.project, timestamp=timestamp).is_limited
        assert self.quota.get_usage(org_id, quotas, timestamp=timestamp) == [2, 2]

        self.quota.refund(self.project, timestamp=timestamp)
        assert self.quota.get_usage(org_id, quotas, timestamp=timestamp) == [1, 1]
