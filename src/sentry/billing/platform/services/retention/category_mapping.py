from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType

from sentry_protos.billing.v1.data_category_pb2 import DataCategory as ProtoDataCategory

from sentry.constants import DataCategory


class RetentionConfigKey(StrEnum):
    LOG = "log"
    SPAN = "span"
    TRACE_METRIC = "traceMetric"


class RetentionAliasGroup(StrEnum):
    LOG = "log"
    SPAN = "span"
    TRACE_METRIC = "trace_metric"


class UnsupportedRetentionCategoryReason(StrEnum):
    UNSPECIFIED = "unspecified"
    UNKNOWN = "unknown"
    NOT_ESTABLISHED = "not_established"


@dataclass(frozen=True)
class RetentionCategoryMapping:
    policy_category: int
    runtime_category: DataCategory
    wire_key: RetentionConfigKey | None
    alias_group: RetentionAliasGroup


@dataclass(frozen=True)
class UnsupportedRetentionCategory:
    policy_category: int
    reason: UnsupportedRetentionCategoryReason


RetentionCategoryDecision = RetentionCategoryMapping | UnsupportedRetentionCategory


_SUPPORTED_DECISIONS: dict[int, RetentionCategoryMapping] = {
    ProtoDataCategory.DATA_CATEGORY_LOG_BYTE: RetentionCategoryMapping(
        policy_category=ProtoDataCategory.DATA_CATEGORY_LOG_BYTE,
        runtime_category=DataCategory.LOG_BYTE,
        wire_key=RetentionConfigKey.LOG,
        alias_group=RetentionAliasGroup.LOG,
    ),
    ProtoDataCategory.DATA_CATEGORY_TRANSACTION: RetentionCategoryMapping(
        policy_category=ProtoDataCategory.DATA_CATEGORY_TRANSACTION,
        runtime_category=DataCategory.TRANSACTION,
        wire_key=RetentionConfigKey.SPAN,
        alias_group=RetentionAliasGroup.SPAN,
    ),
    ProtoDataCategory.DATA_CATEGORY_SPAN: RetentionCategoryMapping(
        policy_category=ProtoDataCategory.DATA_CATEGORY_SPAN,
        runtime_category=DataCategory.SPAN,
        wire_key=RetentionConfigKey.SPAN,
        alias_group=RetentionAliasGroup.SPAN,
    ),
    # Indexed spans share the one span product with TRANSACTION and SPAN. The
    # runtime identity stays distinct so two platform categories do not emit the
    # same runtime key.
    ProtoDataCategory.DATA_CATEGORY_SPAN_INDEXED: RetentionCategoryMapping(
        policy_category=ProtoDataCategory.DATA_CATEGORY_SPAN_INDEXED,
        runtime_category=DataCategory.SPAN_INDEXED,
        wire_key=RetentionConfigKey.SPAN,
        alias_group=RetentionAliasGroup.SPAN,
    ),
    ProtoDataCategory.DATA_CATEGORY_TRACE_METRIC: RetentionCategoryMapping(
        policy_category=ProtoDataCategory.DATA_CATEGORY_TRACE_METRIC,
        runtime_category=DataCategory.TRACE_METRIC,
        wire_key=RetentionConfigKey.TRACE_METRIC,
        alias_group=RetentionAliasGroup.TRACE_METRIC,
    ),
}

_UNSUPPORTED_REASONS: dict[int, UnsupportedRetentionCategoryReason] = {
    ProtoDataCategory.DATA_CATEGORY_UNSPECIFIED: UnsupportedRetentionCategoryReason.UNSPECIFIED,
    ProtoDataCategory.DATA_CATEGORY_ERROR: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_ATTACHMENT: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_PROFILE: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_REPLAY: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_MONITOR: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_USER_REPORT_V2: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_PROFILE_DURATION: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_PROFILE_DURATION_UI: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_SEER_AUTOFIX: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_SEER_SCANNER: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_SIZE_ANALYSIS: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_INSTALLABLE_BUILD: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_DEFAULT: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_SECURITY: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_PROFILE_CHUNK: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_PROFILE_CHUNK_UI: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_TRANSACTION_PROCESSED: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_TRANSACTION_INDEXED: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_PROFILE_INDEXED: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_METRIC_BUCKET: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_ATTACHMENT_ITEM: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_LOG_ITEM: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_PROFILE_BACKEND: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_PROFILE_UI: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_TRACE_METRIC_BYTE: UnsupportedRetentionCategoryReason.NOT_ESTABLISHED,
    ProtoDataCategory.DATA_CATEGORY_UNKNOWN: UnsupportedRetentionCategoryReason.UNKNOWN,
}

_RETENTION_CATEGORY_DECISIONS: dict[int, RetentionCategoryDecision] = {
    **{
        category: UnsupportedRetentionCategory(policy_category=category, reason=reason)
        for category, reason in _UNSUPPORTED_REASONS.items()
    },
    **_SUPPORTED_DECISIONS,
}

RETENTION_CATEGORY_DECISIONS: Mapping[int, RetentionCategoryDecision] = MappingProxyType(
    _RETENTION_CATEGORY_DECISIONS
)


class UnsupportedRetentionCategoryError(ValueError):
    pass


def classify_retention_category(policy_category: int) -> RetentionCategoryDecision:
    category = int(policy_category)
    decision = RETENTION_CATEGORY_DECISIONS.get(category)
    if decision is not None:
        return decision
    return UnsupportedRetentionCategory(
        policy_category=category,
        reason=UnsupportedRetentionCategoryReason.UNKNOWN,
    )


def require_retention_category_mapping(policy_category: int) -> RetentionCategoryMapping:
    decision = classify_retention_category(policy_category)
    if isinstance(decision, RetentionCategoryMapping):
        return decision

    try:
        category_name = ProtoDataCategory.Name(
            ProtoDataCategory.ValueType(decision.policy_category)
        )
    except ValueError:
        category_name = "unknown"
    raise UnsupportedRetentionCategoryError(
        f"Unsupported retention policy category {category_name} ({decision.policy_category}): "
        f"{decision.reason.value}"
    )


def filter_supported_retention_categories(
    policy_categories: Iterable[int],
) -> tuple[RetentionCategoryMapping, ...]:
    mappings = []
    for policy_category in policy_categories:
        decision = classify_retention_category(policy_category)
        if isinstance(decision, RetentionCategoryMapping):
            mappings.append(decision)
    return tuple(mappings)
