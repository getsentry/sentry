from sentry_protos.billing.v1.data_category_pb2 import DataCategory as ProtoDataCategory
from sentry_protos.billing.v1.quota_config_pb2 import QuotaConfig as ProtoQuotaConfig
from sentry_protos.billing.v1.quota_config_pb2 import QuotaScope as ProtoQuotaScope

from sentry.billing.platform.services.quota.quota_config_mapping import (
    proto_to_sentry_quota_config,
    sentry_to_proto_quota_config,
)
from sentry.constants import DataCategory
from sentry.quotas.base import QuotaConfig, QuotaScope


class TestSentryToProtoQuotaConfig:
    def test_basic_conversion(self):
        quota = QuotaConfig(
            id="test_quota",
            categories=[DataCategory.ERROR, DataCategory.TRANSACTION],
            scope=QuotaScope.ORGANIZATION,
            limit=1000,
            window=3600,
            reason_code="org_limit",
        )
        proto = sentry_to_proto_quota_config(quota)

        assert proto.id == "test_quota"
        assert proto.scope == ProtoQuotaScope.QUOTA_SCOPE_ORGANIZATION
        assert proto.limit == 1000
        assert proto.window == 3600
        assert proto.reason_code == "org_limit"
        assert set(proto.categories) == {
            ProtoDataCategory.DATA_CATEGORY_ERROR,
            ProtoDataCategory.DATA_CATEGORY_TRANSACTION,
        }

    def test_reject_all_quota(self):
        quota = QuotaConfig(
            id=None,
            categories=[DataCategory.ERROR],
            scope=QuotaScope.ORGANIZATION,
            limit=0,
            reason_code="blocked",
        )
        proto = sentry_to_proto_quota_config(quota)

        assert proto.id == ""
        assert proto.limit == 0

    def test_scope_id_included(self):
        quota = QuotaConfig(
            id="q",
            categories=[DataCategory.ERROR],
            scope=QuotaScope.PROJECT,
            scope_id="123",
            limit=100,
            window=60,
            reason_code="proj_limit",
        )
        proto = sentry_to_proto_quota_config(quota)
        assert proto.scope_id == "123"


class TestProtoToSentryQuotaConfig:
    def test_basic_conversion(self):
        proto = ProtoQuotaConfig(
            id="test_quota",
            categories=[
                ProtoDataCategory.DATA_CATEGORY_ERROR,
                ProtoDataCategory.DATA_CATEGORY_TRANSACTION,
            ],
            scope=ProtoQuotaScope.QUOTA_SCOPE_ORGANIZATION,
            limit=1000,
            window=3600,
            reason_code="org_limit",
        )
        result = proto_to_sentry_quota_config(proto)

        assert result is not None
        assert result.id == "test_quota"
        assert result.scope == QuotaScope.ORGANIZATION
        assert result.limit == 1000
        assert result.window == 3600
        assert result.reason_code == "org_limit"
        assert DataCategory.ERROR in result.categories
        assert DataCategory.TRANSACTION in result.categories

    def test_unspecified_scope_defaults_to_organization(self):
        proto = ProtoQuotaConfig(
            id="q",
            categories=[ProtoDataCategory.DATA_CATEGORY_ERROR],
            scope=ProtoQuotaScope.QUOTA_SCOPE_UNSPECIFIED,
            limit=100,
            window=60,
            reason_code="limit",
        )
        result = proto_to_sentry_quota_config(proto)

        assert result is not None
        assert result.scope == QuotaScope.ORGANIZATION

    def test_unknown_category_skipped(self):
        """Unmapped proto category values are skipped instead of raising."""
        unmapped_value = ProtoDataCategory.ValueType(9999)
        proto = ProtoQuotaConfig(
            id="q",
            categories=[
                ProtoDataCategory.DATA_CATEGORY_ERROR,
                unmapped_value,
            ],
            scope=ProtoQuotaScope.QUOTA_SCOPE_ORGANIZATION,
            limit=100,
            window=60,
            reason_code="limit",
        )
        result = proto_to_sentry_quota_config(proto)

        assert result is not None
        assert len(result.categories) == 1
        assert DataCategory.ERROR in result.categories

    def test_all_categories_unmapped_returns_none(self):
        """If all categories are unmapped, return None to avoid broadening quota."""
        proto = ProtoQuotaConfig(
            id="q",
            categories=[ProtoDataCategory.ValueType(9999), ProtoDataCategory.ValueType(9998)],
            scope=ProtoQuotaScope.QUOTA_SCOPE_ORGANIZATION,
            limit=100,
            window=60,
            reason_code="limit",
        )
        result = proto_to_sentry_quota_config(proto)

        assert result is None

    def test_empty_categories_preserved(self):
        """Proto with no categories should map to empty (all-data quota), not None."""
        proto = ProtoQuotaConfig(
            id="q",
            scope=ProtoQuotaScope.QUOTA_SCOPE_ORGANIZATION,
            limit=100,
            window=60,
            reason_code="limit",
        )
        result = proto_to_sentry_quota_config(proto)

        assert result is not None
        assert len(result.categories) == 0

    def test_unknown_scope_falls_back_to_organization(self):
        """Unknown scope values fall back to ORGANIZATION instead of raising."""
        proto = ProtoQuotaConfig(
            id="q",
            categories=[ProtoDataCategory.DATA_CATEGORY_ERROR],
            scope=ProtoQuotaScope.ValueType(999),
            limit=100,
            window=60,
            reason_code="limit",
        )
        result = proto_to_sentry_quota_config(proto)

        assert result is not None
        assert result.scope == QuotaScope.ORGANIZATION

    def test_project_scope(self):
        proto = ProtoQuotaConfig(
            id="q",
            categories=[ProtoDataCategory.DATA_CATEGORY_ERROR],
            scope=ProtoQuotaScope.QUOTA_SCOPE_PROJECT,
            scope_id="42",
            limit=100,
            window=60,
            reason_code="limit",
        )
        result = proto_to_sentry_quota_config(proto)

        assert result is not None
        assert result.scope == QuotaScope.PROJECT
        assert result.scope_id == "42"

    def test_key_scope(self):
        proto = ProtoQuotaConfig(
            id="q",
            categories=[ProtoDataCategory.DATA_CATEGORY_ERROR],
            scope=ProtoQuotaScope.QUOTA_SCOPE_KEY,
            limit=100,
            window=60,
            reason_code="limit",
        )
        result = proto_to_sentry_quota_config(proto)

        assert result is not None
        assert result.scope == QuotaScope.KEY

    def test_reject_all_quota(self):
        proto = ProtoQuotaConfig(
            categories=[ProtoDataCategory.DATA_CATEGORY_ERROR],
            scope=ProtoQuotaScope.QUOTA_SCOPE_ORGANIZATION,
            limit=0,
            reason_code="blocked",
        )
        result = proto_to_sentry_quota_config(proto)

        assert result is not None
        assert result.id is None
        assert result.limit == 0


class TestRoundTrip:
    def test_roundtrip_sentry_to_proto_to_sentry(self):
        original = QuotaConfig(
            id="roundtrip",
            categories=[DataCategory.ERROR, DataCategory.SPAN],
            scope=QuotaScope.PROJECT,
            scope_id="99",
            limit=500,
            window=60,
            reason_code="rate_limit",
        )
        proto = sentry_to_proto_quota_config(original)
        restored = proto_to_sentry_quota_config(proto)

        assert restored is not None
        assert restored.id == original.id
        assert restored.categories == original.categories
        assert restored.scope == original.scope
        assert restored.scope_id == original.scope_id
        assert restored.limit == original.limit
        assert restored.window == original.window
        assert restored.reason_code == original.reason_code
