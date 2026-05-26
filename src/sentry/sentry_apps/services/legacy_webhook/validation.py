from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry.utils.payload_comparison import ParityChecker, describe_value

logger = logging.getLogger("sentry.legacy_webhook")


def compare_payloads(old_payload: Mapping[str, Any], new_payload: Mapping[str, Any]) -> list[str]:
    comparator = ParityChecker(format_value=describe_value)
    comparator.compare(old_payload, new_payload, frozenset())
    return comparator.mismatches


def validate_payload_equivalence(
    old_payload: Mapping[str, Any],
    new_payload: Mapping[str, Any],
    organization_id: int,
    project_id: int,
) -> None:
    logging_context = {"organization_id": organization_id, "project_id": project_id}

    if old_payload == new_payload:
        logger.info("legacy_webhook.validation.match", extra=logging_context)
        return

    try:
        mismatches = compare_payloads(old_payload, new_payload)
    except Exception:
        logger.exception("legacy_webhook.validation.comparison_error", extra=logging_context)
        return

    if mismatches:
        logger.warning(
            "legacy_webhook.validation.payload_mismatch",
            extra={**logging_context, "mismatches": mismatches},
        )
