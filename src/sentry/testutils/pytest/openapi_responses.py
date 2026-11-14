"""Check API test responses against the published OpenAPI schema.

Opt in with ``SENTRY_OPENAPI_RESPONSE_CHECK=report`` (collect and summarize) or
``=strict`` (also fail the request that produced a mismatch). The check needs a
fresh ``tests/apidocs/openapi-derefed.json`` from ``make build-api-docs``.

Every response that goes through the Django test client is matched to a public
operation by method and path. Paths and methods missing from the schema are not
public and are skipped. For a public operation the status must be one of the
documented ``responses``, and a JSON body must validate against that status's
schema. See https://github.com/getsentry/sentry/issues/131073.
"""

from __future__ import annotations

import dataclasses
import os
import re
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import orjson
import pytest
from django.test.client import Client
from openapi_schema_validator import OAS30ReadValidator

ENV_VAR = "SENTRY_OPENAPI_RESPONSE_CHECK"
REPO_ROOT = Path(__file__).resolve().parents[4]
SPEC_PATH = REPO_ROOT / "tests/apidocs/openapi-derefed.json"
REPORT_DIR = REPO_ROOT / ".artifacts/openapi-response-check"
API_PREFIX = "/api/0"
HTTP_METHODS = frozenset({"get", "post", "put", "patch", "delete"})


class OpenAPIResponseMismatch(AssertionError):
    pass


@dataclasses.dataclass(frozen=True)
class Operation:
    operation_id: str
    template: str
    method: str
    responses: dict[str, Any]


@dataclasses.dataclass
class Finding:
    key: str
    operation_id: str
    message: str
    test: str
    count: int = 0


class SchemaIndex:
    def __init__(self, spec: dict[str, Any]) -> None:
        routes: list[tuple[int, int, re.Pattern[str], dict[str, Operation]]] = []
        for template, item in spec["paths"].items():
            ops = {
                method: Operation(op["operationId"], template, method, op["responses"])
                for method, op in item.items()
                if method in HTTP_METHODS
            }
            regex = re.compile(
                "^" + re.sub(r"\\\{[^}]+\\\}", "[^/]+", re.escape(API_PREFIX + template)) + "$"
            )
            # Literal segments beat parameters, so `/issues/autofix/` doesn't
            # resolve to `/issues/{issue_id}/`.
            routes.append((template.count("{"), -len(template), regex, ops))
        routes.sort(key=lambda r: (r[0], r[1]))
        self.routes = [(regex, ops) for _, _, regex, ops in routes]

    def find(self, method: str, path: str) -> Operation | None:
        for regex, ops in self.routes:
            if regex.match(path):
                return ops.get(method)
        return None


class Checker:
    def __init__(self, mode: str, spec_path: Path) -> None:
        self.mode = mode
        self.validators: dict[tuple[str, str], Any] = {}
        self.findings: dict[str, Finding] = {}
        self.current_test = "<unknown>"
        self.checked = 0
        self.skipped = 0
        self.seconds = 0.0

        start = time.perf_counter()
        self.index = SchemaIndex(orjson.loads(spec_path.read_bytes()))
        self.load_seconds = time.perf_counter() - start

    def check(self, request_path: str, method: str, response: Any) -> None:
        start = time.perf_counter()
        try:
            problem = self._check(request_path, method.lower(), response)
        finally:
            self.seconds += time.perf_counter() - start
        if problem and self.mode == "strict":
            raise OpenAPIResponseMismatch(problem)

    def _check(self, path: str, method: str, response: Any) -> str | None:
        operation = self.index.find(method, path)
        if operation is None:
            self.skipped += 1
            return None
        self.checked += 1

        status = str(response.status_code)
        documented = operation.responses.get(status) or operation.responses.get(f"{status[0]}XX")
        if documented is None:
            return self._record(
                operation,
                status,
                "undocumented-status",
                f"documented: {', '.join(sorted(operation.responses))}",
            )

        schema = documented.get("content", {}).get("application/json", {}).get("schema")
        content_type = response.get("Content-Type", "")
        if schema is None or not content_type.startswith("application/json"):
            return None
        if getattr(response, "streaming", False) or not response.content:
            return None

        validator = self.validators.get((operation.operation_id, status))
        if validator is None:
            validator = self.validators[(operation.operation_id, status)] = OAS30ReadValidator(
                schema
            )
        error = next(iter(validator.iter_errors(orjson.loads(response.content))), None)
        if error is None:
            return None
        location = "/".join(str(p) for p in error.absolute_path) or "<root>"
        return self._record(
            operation, status, "body-mismatch", f"{location}: {error.message[:300]}"
        )

    def _record(self, operation: Operation, status: str, kind: str, message: str) -> str:
        key = f"{operation.method.upper()} {operation.template} {status} {kind}"
        finding = self.findings.get(key)
        if finding is None:
            finding = self.findings[key] = Finding(
                key, operation.operation_id, message, self.current_test
            )
        finding.count += 1
        return f"{key} ({operation.operation_id}): {message}"

    def dump(self, worker: str) -> None:
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        (REPORT_DIR / f"{worker}.json").write_bytes(
            orjson.dumps(
                {
                    "checked": self.checked,
                    "skipped": self.skipped,
                    "check_seconds": self.seconds,
                    "load_seconds": self.load_seconds,
                    "findings": [dataclasses.asdict(f) for f in self.findings.values()],
                }
            )
        )


_checker: Checker | None = None


def _wrap(request: Callable[..., Any]) -> Callable[..., Any]:
    def wrapper(self: Client, **kwargs: Any) -> Any:
        response = request(self, **kwargs)
        if _checker is not None:
            _checker.check(kwargs.get("PATH_INFO", ""), kwargs.get("REQUEST_METHOD", ""), response)
        return response

    return wrapper


def _worker_id(config: pytest.Config) -> str:
    workerinput = getattr(config, "workerinput", None)
    return workerinput["workerid"] if workerinput else "main"


def pytest_configure(config: pytest.Config) -> None:
    global _checker
    mode = os.environ.get(ENV_VAR, "")
    if mode not in ("report", "strict"):
        return
    if not SPEC_PATH.exists():
        raise pytest.UsageError(f"{ENV_VAR} needs {SPEC_PATH}; run `make build-api-docs`")
    if not hasattr(config, "workerinput") and REPORT_DIR.exists():
        for stale in REPORT_DIR.glob("*.json"):
            stale.unlink()
    _checker = Checker(mode, SPEC_PATH)
    Client.request = _wrap(Client.request)  # type: ignore[method-assign]


def pytest_runtest_setup(item: pytest.Item) -> None:
    if _checker is not None:
        _checker.current_test = item.nodeid


def pytest_sessionfinish(session: pytest.Session) -> None:
    if _checker is not None and _checker.checked + _checker.skipped:
        _checker.dump(_worker_id(session.config))


def pytest_terminal_summary(terminalreporter: Any, config: pytest.Config) -> None:
    if _checker is None or hasattr(config, "workerinput"):
        return
    checked = skipped = 0
    check_seconds = 0.0
    findings: dict[str, dict[str, Any]] = {}
    for path in sorted(REPORT_DIR.glob("*.json")):
        data = orjson.loads(path.read_bytes())
        checked += data["checked"]
        skipped += data["skipped"]
        check_seconds += data["check_seconds"]
        for f in data["findings"]:
            existing = findings.setdefault(f["key"], f)
            if existing is not f:
                existing["count"] += f["count"]

    terminalreporter.section("OpenAPI response check")
    terminalreporter.write_line(
        f"{checked} responses to documented operations checked, {skipped} not in the schema, "
        f"{check_seconds:.2f}s spent checking, {len(findings)} distinct mismatches"
    )
    for f in sorted(findings.values(), key=lambda f: f["key"]):
        terminalreporter.write_line(f"  {f['key']} x{f['count']} [{f['operation_id']}]")
        terminalreporter.write_line(f"      {f['message']}")
        terminalreporter.write_line(f"      first seen in {f['test']}")
