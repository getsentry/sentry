from __future__ import annotations

from tools.api_guidelines.owners import owner_for
from tools.api_guidelines.signature import BaselineSignature
from tools.flake8_plugin import ApiInputViolation


def _sort_key(signature: BaselineSignature) -> tuple[str, str, str, str]:
    """exceptions.json's order: path, then scope, then rule, then key (key can be None)."""
    return (signature.path, signature.scope, signature.rule, signature.key or "")


def build_entries(
    violations: list[tuple[str, ApiInputViolation]],
    owner_map: dict[str, dict[str, str]],
    today: str,
) -> list[dict[str, object]]:
    """One entry per signature (rule, path, scope, key), counted, with the imported defaults"""

    # {signature: (how many times it appeared -> count, the caller of its first finding -> caller)}
    count_caller_signature: dict[BaselineSignature, tuple[int, str | None]] = {}

    for path, violation in violations:
        new_signature = BaselineSignature(
            rule=violation.rule, path=path, scope=violation.scope, key=violation.key
        )

        # check if the signature is already in the dict
        if new_signature in count_caller_signature:
            # add one to its count and keep the first finding's caller
            count, first_caller = count_caller_signature[new_signature]
            count_caller_signature[new_signature] = (count + 1, first_caller)

        else:
            count_caller_signature[new_signature] = (1, violation.caller)

    # go through the signatures in sorted order: path, then scope, then rule, then key
    entries: list[dict[str, object]] = []
    for signature in sorted(count_caller_signature, key=_sort_key):
        count, first_caller = count_caller_signature[signature]

        entries.append(
            {
                "rule": str(signature.rule),
                "path": signature.path,
                "scope": signature.scope,
                "key": signature.key,
                "count": count,
                "owner": owner_for(signature.path, signature.scope, first_caller, owner_map),
                # the safe default until the review issue sets the real status
                "status": "debt-breaking",
                "reason": f"legacy: predates {signature.rule}",
                "first_seen": today,
            }
        )

    return entries
