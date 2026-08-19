from dataclasses import FrozenInstanceError

import pytest
from sentry_protos.billing.v1.data_category_pb2 import DataCategory as ProtoDataCategory

from sentry.billing.platform.services.retention import (
    RETENTION_CATEGORY_DECISIONS,
    RetentionAliasGroup,
    RetentionCategoryMapping,
    RetentionConfigKey,
    UnsupportedRetentionCategory,
    UnsupportedRetentionCategoryError,
    UnsupportedRetentionCategoryReason,
    classify_retention_category,
    filter_supported_retention_categories,
    require_retention_category_mapping,
)
from sentry.constants import DataCategory
from sentry.quotas.base import RETENTIONS_CONFIG_MAPPING

EXPECTED_PROTO_CATEGORIES = {
    ("DATA_CATEGORY_UNKNOWN", -1),
    ("DATA_CATEGORY_UNSPECIFIED", 0),
    ("DATA_CATEGORY_ERROR", 1),
    ("DATA_CATEGORY_TRANSACTION", 2),
    ("DATA_CATEGORY_ATTACHMENT", 3),
    ("DATA_CATEGORY_PROFILE", 4),
    ("DATA_CATEGORY_REPLAY", 5),
    ("DATA_CATEGORY_MONITOR", 6),
    ("DATA_CATEGORY_SPAN", 7),
    ("DATA_CATEGORY_USER_REPORT_V2", 8),
    ("DATA_CATEGORY_PROFILE_DURATION", 9),
    ("DATA_CATEGORY_LOG_BYTE", 10),
    ("DATA_CATEGORY_PROFILE_DURATION_UI", 11),
    ("DATA_CATEGORY_SEER_AUTOFIX", 12),
    ("DATA_CATEGORY_SEER_SCANNER", 13),
    ("DATA_CATEGORY_SIZE_ANALYSIS", 14),
    ("DATA_CATEGORY_INSTALLABLE_BUILD", 15),
    ("DATA_CATEGORY_TRACE_METRIC", 16),
    ("DATA_CATEGORY_DEFAULT", 17),
    ("DATA_CATEGORY_SECURITY", 18),
    ("DATA_CATEGORY_PROFILE_CHUNK", 19),
    ("DATA_CATEGORY_PROFILE_CHUNK_UI", 20),
    ("DATA_CATEGORY_SPAN_INDEXED", 21),
    ("DATA_CATEGORY_TRANSACTION_PROCESSED", 22),
    ("DATA_CATEGORY_TRANSACTION_INDEXED", 23),
    ("DATA_CATEGORY_PROFILE_INDEXED", 24),
    ("DATA_CATEGORY_METRIC_BUCKET", 25),
    ("DATA_CATEGORY_ATTACHMENT_ITEM", 26),
    ("DATA_CATEGORY_LOG_ITEM", 27),
    ("DATA_CATEGORY_PROFILE_BACKEND", 30),
    ("DATA_CATEGORY_PROFILE_UI", 31),
    ("DATA_CATEGORY_TRACE_METRIC_BYTE", 32),
}

SUPPORTED_MAPPINGS = (
    (
        ProtoDataCategory.DATA_CATEGORY_LOG_BYTE,
        DataCategory.LOG_BYTE,
        RetentionConfigKey.LOG,
        RetentionAliasGroup.LOG,
    ),
    (
        ProtoDataCategory.DATA_CATEGORY_TRANSACTION,
        DataCategory.TRANSACTION,
        RetentionConfigKey.SPAN,
        RetentionAliasGroup.SPAN,
    ),
    (
        ProtoDataCategory.DATA_CATEGORY_SPAN,
        DataCategory.SPAN,
        RetentionConfigKey.SPAN,
        RetentionAliasGroup.SPAN,
    ),
    (
        ProtoDataCategory.DATA_CATEGORY_SPAN_INDEXED,
        DataCategory.SPAN_INDEXED,
        RetentionConfigKey.SPAN,
        RetentionAliasGroup.SPAN,
    ),
    (
        ProtoDataCategory.DATA_CATEGORY_TRACE_METRIC,
        DataCategory.TRACE_METRIC,
        RetentionConfigKey.TRACE_METRIC,
        RetentionAliasGroup.TRACE_METRIC,
    ),
)


def test_all_proto_categories_have_an_explicit_retention_decision() -> None:
    actual_categories = {
        (value.name, value.number) for value in ProtoDataCategory.DESCRIPTOR.values
    }

    assert actual_categories == EXPECTED_PROTO_CATEGORIES
    assert set(RETENTION_CATEGORY_DECISIONS) == {number for _, number in EXPECTED_PROTO_CATEGORIES}


@pytest.mark.parametrize(
    ("policy_category", "runtime_category", "wire_key", "alias_group"),
    SUPPORTED_MAPPINGS,
)
def test_supported_mapping(
    policy_category: int,
    runtime_category: DataCategory,
    wire_key: RetentionConfigKey,
    alias_group: RetentionAliasGroup,
) -> None:
    decision = classify_retention_category(policy_category)

    assert decision == RetentionCategoryMapping(
        policy_category=policy_category,
        runtime_category=runtime_category,
        wire_key=wire_key,
        alias_group=alias_group,
    )


@pytest.mark.parametrize(
    ("policy_category", "reason"),
    [
        (
            ProtoDataCategory.DATA_CATEGORY_UNSPECIFIED,
            UnsupportedRetentionCategoryReason.UNSPECIFIED,
        ),
        (ProtoDataCategory.DATA_CATEGORY_UNKNOWN, UnsupportedRetentionCategoryReason.UNKNOWN),
    ],
)
def test_special_unsupported_category(
    policy_category: int, reason: UnsupportedRetentionCategoryReason
) -> None:
    assert classify_retention_category(policy_category) == UnsupportedRetentionCategory(
        policy_category=policy_category,
        reason=reason,
    )


def test_every_other_named_category_is_not_established() -> None:
    supported = {category for category, _, _, _ in SUPPORTED_MAPPINGS}
    special = {
        ProtoDataCategory.DATA_CATEGORY_UNSPECIFIED,
        ProtoDataCategory.DATA_CATEGORY_UNKNOWN,
    }

    for _, policy_category in EXPECTED_PROTO_CATEGORIES:
        if policy_category in supported | special:
            continue
        assert classify_retention_category(policy_category) == UnsupportedRetentionCategory(
            policy_category=policy_category,
            reason=UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
        )


def test_arbitrary_future_category_is_unknown() -> None:
    assert classify_retention_category(9999) == UnsupportedRetentionCategory(
        policy_category=9999,
        reason=UnsupportedRetentionCategoryReason.UNKNOWN,
    )


def test_mapping_is_frozen() -> None:
    mapping = require_retention_category_mapping(ProtoDataCategory.DATA_CATEGORY_LOG_BYTE)

    with pytest.raises(FrozenInstanceError):
        mapping.policy_category = ProtoDataCategory.DATA_CATEGORY_ERROR  # type: ignore[misc]


@pytest.mark.parametrize(
    "policy_category",
    [
        ProtoDataCategory.DATA_CATEGORY_ERROR,
        ProtoDataCategory.DATA_CATEGORY_UNSPECIFIED,
        ProtoDataCategory.DATA_CATEGORY_UNKNOWN,
        9999,
    ],
)
def test_required_lookup_rejects_unsupported_category(policy_category: int) -> None:
    with pytest.raises(UnsupportedRetentionCategoryError, match=str(policy_category)):
        require_retention_category_mapping(policy_category)


def test_filter_supported_categories_is_explicit_and_ordered() -> None:
    filtered = filter_supported_retention_categories(
        [
            ProtoDataCategory.DATA_CATEGORY_LOG_BYTE,
            ProtoDataCategory.DATA_CATEGORY_ERROR,
            ProtoDataCategory.DATA_CATEGORY_TRANSACTION,
            ProtoDataCategory.DATA_CATEGORY_UNKNOWN,
            ProtoDataCategory.DATA_CATEGORY_SPAN,
            ProtoDataCategory.DATA_CATEGORY_LOG_BYTE,
        ]
    )

    assert [mapping.policy_category for mapping in filtered] == [
        ProtoDataCategory.DATA_CATEGORY_LOG_BYTE,
        ProtoDataCategory.DATA_CATEGORY_TRANSACTION,
        ProtoDataCategory.DATA_CATEGORY_SPAN,
        ProtoDataCategory.DATA_CATEGORY_LOG_BYTE,
    ]


def test_filter_empty_or_all_unsupported_categories() -> None:
    assert filter_supported_retention_categories([]) == ()
    assert (
        filter_supported_retention_categories(
            [ProtoDataCategory.DATA_CATEGORY_ERROR, ProtoDataCategory.DATA_CATEGORY_REPLAY]
        )
        == ()
    )


def test_span_alias_keeps_distinct_runtime_categories() -> None:
    transaction = require_retention_category_mapping(ProtoDataCategory.DATA_CATEGORY_TRANSACTION)
    span = require_retention_category_mapping(ProtoDataCategory.DATA_CATEGORY_SPAN)

    assert transaction.runtime_category != span.runtime_category
    assert transaction.wire_key == span.wire_key == RetentionConfigKey.SPAN
    assert transaction.alias_group == span.alias_group == RetentionAliasGroup.SPAN


def test_supported_wire_mapping_matches_existing_retention_config() -> None:
    # The adapter may map runtime categories the legacy map does not project
    # (for example SPAN_INDEXED). Assert it agrees with the legacy map on every
    # runtime category the legacy map covers, rather than requiring exact
    # equality with the broader adapter set.
    actual = {
        mapping.runtime_category: mapping.wire_key.value
        for mapping in RETENTION_CATEGORY_DECISIONS.values()
        if isinstance(mapping, RetentionCategoryMapping) and mapping.wire_key is not None
    }

    for runtime_category, wire_key in RETENTIONS_CONFIG_MAPPING.items():
        assert actual[runtime_category] == wire_key
