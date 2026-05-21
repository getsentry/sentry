from __future__ import annotations

import logging
from typing import Any

from sentry.utils.payload_comparison import ParityChecker, describe_value

logger = logging.getLogger("sentry.legacy_webhook")


def compare_payloads(old_payload: dict[str, Any], new_payload: dict[str, Any]) -> list[str]:
    comparator = ParityChecker(format_value=describe_value)
    comparator.compare(old_payload, new_payload, frozenset())
    return comparator.mismatches


def validate_payload_equivalence(
    old_payload: dict[str, Any],
    new_payload: dict[str, Any],
    organization_id: int,
    project_id: int,
) -> None:
    try:
        if old_payload == new_payload:
            logger.info(
                "legacy_webhook.validation.match",
                extra={"organization_id": organization_id, "project_id": project_id},
            )
            return

        mismatches = compare_payloads(old_payload, new_payload)
        for mismatch in mismatches:
            logger.warning(
                "legacy_webhook.validation.payload_mismatch",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "mismatch": mismatch,
                },
            )
    except Exception:
        logger.exception(
            "legacy_webhook.validation.comparison_error",
            extra={"organization_id": organization_id, "project_id": project_id},
        )
