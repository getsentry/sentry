"""Collect undeclared permission-scope checks while running existing endpoint tests.

Example:
    .venv/bin/python -m pytest -q --reuse-db -p tools.pytest_scope_audit \
        tests/sentry/core/endpoints/test_team_projects.py

Run without pytest-xdist so findings can be aggregated in one process.
"""

from __future__ import annotations

import json
from collections import Counter
from contextlib import AbstractContextManager
from typing import Any

Finding = tuple[str, str, str, tuple[str, ...], tuple[str, ...]]

_findings: Counter[Finding] = Counter()
_options_override: AbstractContextManager[None] | None = None


def pytest_configure() -> None:
    global _options_override

    from sentry.auth import scope_declaration
    from sentry.testutils.helpers.options import override_options

    def record_warning(message: str, *, extra: dict[str, Any]) -> None:
        assert message == "api.permission_scope.undeclared"
        _findings[
            (
                extra["endpoint"],
                extra["method"],
                extra["scope"],
                tuple(extra["declared_scopes"]),
                tuple(extra["permission_classes"]),
            )
        ] += 1

    def discard_capture_message(*args: Any, **kwargs: Any) -> None:
        # The warning is the audit signal. Avoid creating SDK events while a broad
        # endpoint test run deliberately exercises known declaration gaps.
        pass

    scope_declaration.logger.warning = record_warning
    scope_declaration.capture_message = discard_capture_message
    _options_override = override_options({"api.permission-scope-audit.enabled": True})
    _options_override.__enter__()


def pytest_unconfigure() -> None:
    if _options_override is not None:
        _options_override.__exit__(None, None, None)


def pytest_sessionfinish() -> None:
    for finding, count in sorted(_findings.items()):
        endpoint, method, scope, declared_scopes, permission_classes = finding
        print(
            "SCOPE_AUDIT_SUMMARY "
            + json.dumps(
                {
                    "count": count,
                    "declared_scopes": declared_scopes,
                    "endpoint": endpoint,
                    "method": method,
                    "permission_classes": permission_classes,
                    "scope": scope,
                },
                sort_keys=True,
            )
        )
