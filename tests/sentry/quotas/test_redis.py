import time
from functools import cached_property
from unittest import mock

import pytest

from sentry.constants import DataCategory
from sentry.quotas.base import QuotaConfig, QuotaScope
from sentry.quotas.redis import RedisQuota, is_rate_limited
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.redis import clusters


def test_is_rate_limited_script():
    now = int(time.time())

    cluster = clusters.get("default")
    client = cluster.get_local_client(next(iter(cluster.hosts)))

    # The item should not be rate limited by either key.
    assert list(
        map(
            bool,
            is_rate_limited(client, ("foo", "r:foo", "bar", "r:bar"), (1, now + 60, 2, now + 120)),
        )
    ) == [False, False]

    # The item should be rate limited by the first key (1).
    assert list(
        map(
            bool,
            is_rate_limited(client, ("foo", "r:foo", "bar", "r:bar"), (1, now + 60, 2, now + 120)),
        )
    ) == [True, False]

    # The item should still be rate limited by the first key (1), but *not*
    # rate limited by the second key (2) even though this is the third time
    # we've checked the quotas. This ensures items that are rejected by a lower
    # quota don't affect unrelated items that share a parent quota.
    assert list(
        map(
            bool,
            is_rate_limited(client, ("foo", "r:foo", "bar", "r:bar"), (1, now + 60, 2, now + 120)),
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
    is_rate_limited(client, ("orange", "baz"), (1, now + 60))
    # test that it's rate limited without refund
    assert list(map(bool, is_rate_limited(client, ("orange", "baz"), (1, now + 60)))) == [True]
    # test that refund key is used
    assert list(map(bool, is_rate_limited(client, ("orange", "apple"), (1, now + 60)))) == [False]


@region_silo_test
class RedisQuotaTest(TestCase):
    @cached_property
    def quota(self):
        return RedisQuota()

    def test_abuse_quotas(self):
        # These legacy options need to be set, otherwise we'll run into
        # AssertionError: reject-all quotas cannot be tracked
        self.get_project_quota.return_value = (100, 10)
        self.get_organization_quota.return_value = (1000, 10)

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

        self.organization.update_option("project-abuse-quota.transaction-limit", 600)
        self.organization.update_option("project-abuse-quota.attachment-limit", 601)
        self.organization.update_option("project-abuse-quota.session-limit", 602)
        self.organization.update_option("organization-abuse-quota.metric-bucket-limit", 603)
        with self.feature("organizations:transaction-metrics-extraction"):
            quotas = self.quota.get_quotas(self.project)

        assert quotas[1].id == "pati"
        assert quotas[1].scope == QuotaScope.PROJECT
        assert quotas[1].scope_id is None
        assert quotas[1].categories == {DataCategory.TRANSACTION_INDEXED}
        assert quotas[1].limit == 6000
        assert quotas[1].window == 10
        assert quotas[1].reason_code == "project_abuse_limit"

        assert quotas[2].id == "paa"
        assert quotas[2].scope == QuotaScope.PROJECT
        assert quotas[2].scope_id is None
        assert quotas[2].categories == {DataCategory.ATTACHMENT}
        assert quotas[2].limit == 6010
        assert quotas[2].window == 10
        assert quotas[2].reason_code == "project_abuse_limit"

        assert quotas[3].id == "pas"
        assert quotas[3].scope == QuotaScope.PROJECT
        assert quotas[3].scope_id is None
        assert quotas[3].categories == {DataCategory.SESSION}
        assert quotas[3].limit == 6020
        assert quotas[3].window == 10
        assert quotas[3].reason_code == "project_abuse_limit"

        assert quotas[4].id == "oam"
        assert quotas[4].scope == QuotaScope.ORGANIZATION
        assert quotas[4].scope_id is None
        assert quotas[4].categories == {DataCategory.METRIC_BUCKET}
        assert quotas[4].limit == 6030
        assert quotas[4].window == 10
        assert quotas[4].reason_code == "org_abuse_limit"

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

    def test_legacy_transaction_quota(self):
        # These legacy options need to be set, otherwise we'll run into
        # AssertionError: reject-all quotas cannot be tracked
        self.get_project_quota.return_value = (100, 10)
        self.get_organization_quota.return_value = (1000, 10)

        self.organization.update_option("project-abuse-quota.transaction-limit", 600)
        with self.feature({"organizations:transaction-metrics-extraction": False}):
            quotas = self.quota.get_quotas(self.project)

        assert quotas[0].id == "pati"
        assert quotas[0].scope == QuotaScope.PROJECT
        assert quotas[0].scope_id is None
        assert quotas[0].categories == {DataCategory.TRANSACTION}
        assert quotas[0].limit == 6000
        assert quotas[0].window == 10
        assert quotas[0].reason_code == "project_abuse_limit"

    @pytest.fixture(autouse=True)
    def _patch_get_project_quota(self):
        with mock.patch.object(
            RedisQuota, "get_project_quota", return_value=(0, 60)
        ) as self.get_project_quota:
            yield

    @pytest.fixture(autouse=True)
    def _patch_get_organization_quota(self):
        with mock.patch.object(
            RedisQuota, "get_organization_quota", return_value=(0, 60)
        ) as self.get_organization_quota:
            yield

    def test_uses_defined_quotas(self):
        self.get_project_quota.return_value = (200, 60)
        self.get_organization_quota.return_value = (300, 60)
        quotas = self.quota.get_quotas(self.project)

        assert quotas[0].id == "p"
        assert quotas[0].scope == QuotaScope.PROJECT
        assert quotas[0].scope_id == str(self.project.id)
        assert quotas[0].limit == 200
        assert quotas[0].window == 60
        assert quotas[1].id == "o"
        assert quotas[1].scope == QuotaScope.ORGANIZATION
        assert quotas[1].scope_id == str(self.organization.id)
        assert quotas[1].limit == 300
        assert quotas[1].window == 60

    @mock.patch("sentry.quotas.redis.is_rate_limited")
    @mock.patch.object(RedisQuota, "get_quotas", return_value=[])
    def test_bails_immediately_without_any_quota(self, get_quotas, is_rate_limited):
        result = self.quota.is_rate_limited(self.project)
        assert not is_rate_limited.called
        assert not result.is_limited

    @mock.patch("sentry.quotas.redis.is_rate_limited", return_value=(False, False))
    def test_is_not_limited_without_rejections(self, is_rate_limited):
        self.get_organization_quota.return_value = (100, 60)
        self.get_project_quota.return_value = (200, 60)
        assert not self.quota.is_rate_limited(self.project).is_limited

    @mock.patch("sentry.quotas.redis.is_rate_limited", return_value=(True, False))
    def test_is_limited_on_rejections(self, is_rate_limited):
        self.get_organization_quota.return_value = (100, 60)
        self.get_project_quota.return_value = (200, 60)
        assert self.quota.is_rate_limited(self.project).is_limited

    @mock.patch.object(RedisQuota, "get_quotas")
    @mock.patch("sentry.quotas.redis.is_rate_limited", return_value=(False, False))
    def test_not_limited_with_unlimited_quota(self, mock_is_rate_limited, mock_get_quotas):
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
    def test_limited_with_unlimited_quota(self, mock_is_rate_limited, mock_get_quotas):
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

    def test_get_usage(self):
        timestamp = time.time()

        self.get_project_quota.return_value = (200, 60)
        self.get_organization_quota.return_value = (300, 60)

        n = 10
        for _ in range(n):
            self.quota.is_rate_limited(self.project, timestamp=timestamp)

        quotas = self.quota.get_quotas(self.project)
        all_quotas = quotas + [
            QuotaConfig(id="unlimited", limit=None, window=60, reason_code="unlimited"),
            QuotaConfig(id="dummy", limit=10, window=60, reason_code="dummy"),
        ]

        usage = self.quota.get_usage(self.project.organization_id, all_quotas, timestamp=timestamp)

        # Only quotas with an ID are counted in Redis (via this ID). Assume the
        # count for these quotas and None for the others.
        assert usage == [n if q.id else None for q in quotas] + [0, 0]

    @mock.patch.object(RedisQuota, "get_quotas")
    def test_refund_defaults(self, mock_get_quotas):
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
    def test_refund_categories(self, mock_get_quotas):
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

    def test_get_usage_uses_refund(self):
        timestamp = time.time()

        self.get_project_quota.return_value = (200, 60)
        self.get_organization_quota.return_value = (300, 60)

        n = 10
        for _ in range(n):
            self.quota.is_rate_limited(self.project, timestamp=timestamp)

        self.quota.refund(self.project, timestamp=timestamp)

        quotas = self.quota.get_quotas(self.project)
        all_quotas = quotas + [
            QuotaConfig(id="unlimited", limit=None, window=60, reason_code="unlimited"),
            QuotaConfig(id="dummy", limit=10, window=60, reason_code="dummy"),
        ]

        usage = self.quota.get_usage(self.project.organization_id, all_quotas, timestamp=timestamp)

        # Only quotas with an ID are counted in Redis (via this ID). Assume the
        # count for these quotas and None for the others.
        # The ``- 1`` is because we refunded once.
        assert usage == [n - 1 if q.id else None for q in quotas] + [0, 0]
