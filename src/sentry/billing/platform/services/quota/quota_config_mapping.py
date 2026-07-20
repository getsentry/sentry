from __future__ import annotations

import logging

from sentry_protos.billing.v1.quota_config_pb2 import QuotaConfig as ProtoQuotaConfig
from sentry_protos.billing.v1.quota_config_pb2 import QuotaScope as ProtoQuotaScope

from sentry.billing.platform.services.category_mapping import (
    proto_to_sentry_category,
    sentry_to_proto_category,
)
from sentry.constants import DataCategory
from sentry.quotas.base import QuotaConfig, QuotaScope

logger = logging.getLogger(__name__)


def sentry_to_proto_quota_config(quota: QuotaConfig) -> ProtoQuotaConfig:
    """Convert a sentry QuotaConfig to its proto equivalent."""
    kwargs: dict = {
        "id": quota.id or "",
        "categories": sorted(sentry_to_proto_category(int(c)) for c in quota.categories),
        "scope": ProtoQuotaScope.ValueType(int(quota.scope))
        if quota.scope is not None
        else ProtoQuotaScope.QUOTA_SCOPE_UNSPECIFIED,
    }
    if quota.scope_id is not None:
        kwargs["scope_id"] = quota.scope_id
    if quota.limit is not None:
        kwargs["limit"] = quota.limit
    if quota.window is not None:
        kwargs["window"] = quota.window
    if quota.reason_code is not None:
        kwargs["reason_code"] = quota.reason_code

    return ProtoQuotaConfig(**kwargs)


def proto_to_sentry_quota_config(proto_quota: ProtoQuotaConfig) -> QuotaConfig | None:
    """Convert a proto QuotaConfig to its sentry equivalent.

    Returns None if the proto had categories but none could be mapped,
    since an empty category set would broaden the quota to all data.
    """
    categories: list[DataCategory] = []
    for c in proto_quota.categories:
        sentry_cat = proto_to_sentry_category(c)
        try:
            categories.append(DataCategory(sentry_cat))
        except ValueError:
            logger.error(
                "quota_config_mapping.unknown_category",
                extra={"proto_category": c, "mapped_value": sentry_cat},
            )

    if proto_quota.categories and not categories:
        logger.warning(
            "quota_config_mapping.all_categories_dropped",
            extra={"proto_categories": list(proto_quota.categories)},
        )
        return None

    try:
        scope = (
            QuotaScope(proto_quota.scope)
            if proto_quota.scope != ProtoQuotaScope.QUOTA_SCOPE_UNSPECIFIED
            else QuotaScope.ORGANIZATION
        )
    except ValueError:
        logger.error(
            "quota_config_mapping.unknown_scope",
            extra={"proto_scope": proto_quota.scope},
        )
        scope = QuotaScope.ORGANIZATION

    return QuotaConfig(
        id=proto_quota.id or None,
        categories=categories,
        scope=scope,
        scope_id=proto_quota.scope_id if proto_quota.HasField("scope_id") else None,
        limit=proto_quota.limit if proto_quota.HasField("limit") else None,
        window=proto_quota.window if proto_quota.HasField("window") else None,
        reason_code=proto_quota.reason_code if proto_quota.HasField("reason_code") else None,
    )
