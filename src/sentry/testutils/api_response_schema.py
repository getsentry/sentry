"""
Check what API tests get back from public endpoints against the published OpenAPI schema.

`APITestCaseMixin.get_response` passes every response to `observe`. For an operation whose
endpoint has `publish_status[METHOD] == PUBLIC`, it checks that the status is a key in the
operation's `responses` in `tests/apidocs/openapi-derefed.json`, and that a JSON body matches
the schema documented for that status. A status documented without a JSON body is only
checked for the status itself, and an undocumented 5xx is not reported.

`ResponseSchemaReporter`, which `sentry.testutils.pytest.api_response_schema` registers,
summarizes what the run found and writes it to `.artifacts/api-response-schema.json`.
`SENTRY_API_RESPONSE_SCHEMA` picks the mode:

- `report` (default): collect mismatches and summarize them after the run.
- `strict`: fail a test whose response has a mismatch that is not in the baseline.
- `update`: add every mismatch the run sees to the baseline.
- `off`: do nothing.

Build the schema with `make build-api-docs`. Without it, nothing is checked.
"""

from __future__ import annotations

import os
from collections import Counter
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from enum import Enum
from functools import cached_property
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import urlsplit

import orjson
import pytest
from _pytest.terminal import TerminalReporter
from django.http.response import HttpResponseBase
from django.urls import Resolver404
from jsonschema.exceptions import best_match
from openapi_schema_validator import OAS30ReadValidator, oas30_format_checker

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.apidocs.hooks import CustomEndpointEnumerator, _canonical_issue_path

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = REPO_ROOT / "tests" / "apidocs" / "openapi-derefed.json"
BASELINE_PATH = REPO_ROOT / "tests" / "apidocs" / "response-schema-baseline.txt"
REPORT_PATH = REPO_ROOT / ".artifacts" / "api-response-schema.json"
MODE_ENV = "SENTRY_API_RESPONSE_SCHEMA"

UNDOCUMENTED_STATUS = "undocumented-status"
BODY_MISMATCH = "body-mismatch"

_BASELINE_HEADER = """\
# Public API responses seen in tests that don't match tests/apidocs/openapi-derefed.json.
# See src/sentry/testutils/api_response_schema.py. Remove a line once it is fixed. Add the
# mismatches a test run sees with: SENTRY_API_RESPONSE_SCHEMA=update pytest <tests>
"""
_MAX_DETAIL = 300
_SHOWN_NEW_MISMATCHES = 20
_WORKER_OUTPUT_KEY = "sentry_api_response_schema"


class Mode(Enum):
    OFF = "off"
    REPORT = "report"
    STRICT = "strict"
    UPDATE = "update"


def mode_from_env() -> Mode:
    value = os.environ.get(MODE_ENV, Mode.REPORT.value)
    try:
        return Mode(value)
    except ValueError:
        raise ValueError(
            f"{MODE_ENV}={value!r} is not one of {', '.join(m.value for m in Mode)}"
        ) from None


@dataclass(frozen=True)
class Mismatch:
    kind: str
    method: str
    path: str
    status: int
    detail: str

    @property
    def key(self) -> str:
        return f"{self.kind} {self.method} {self.path} {self.status}"


class Schema:
    def __init__(self, document: Mapping[str, Any]) -> None:
        self.base_path = urlsplit(document["servers"][0]["url"]).path.rstrip("/")
        self.paths: Mapping[str, Mapping[str, Any]] = document["paths"]
        self._validators: dict[tuple[str, str, str], OAS30ReadValidator] = {}

    @classmethod
    def load(cls, path: Path) -> Schema:
        return cls(orjson.loads(path.read_bytes()))

    def operation(self, path: str, method: str) -> Mapping[str, Any] | None:
        return self.paths.get(path, {}).get(method.lower())

    def validator(self, path: str, method: str, status: str, schema: Any) -> OAS30ReadValidator:
        key = (path, method, status)
        validator = self._validators.get(key)
        if validator is None:
            validator = OAS30ReadValidator(schema, format_checker=oas30_format_checker)
            self._validators[key] = validator
        return validator


class _RouteMapper:
    """Turns a resolved URL route into the path key it has in the schema.

    Uses the enumerator the schema build uses, so aliases such as `(?:issues|groups)` map
    to the same documented path.
    """

    def __init__(self, base_path: str) -> None:
        self._base_path = base_path
        self._enumerator = CustomEndpointEnumerator()
        self._cache: dict[str, str] = {}

    def __call__(self, route: str) -> str:
        path = self._cache.get(route)
        if path is None:
            path = _canonical_issue_path(self._enumerator.get_path_from_regex(route))
            path = path.removeprefix(self._base_path)
            self._cache[route] = path
        return path


@dataclass(frozen=True)
class _Request:
    method: str
    route: str


def _public_request(response: HttpResponseBase) -> _Request | None:
    request = getattr(response, "request", None)
    if not isinstance(request, Mapping):
        return None
    try:
        # The test client resolves this lazily, and a path no URL pattern matches raises.
        match = getattr(response, "resolver_match", None)
        func = match.func if match is not None else None
    except Resolver404:
        return None
    if match is None or func is None:
        return None
    publish_status = getattr(getattr(func, "view_class", None), "publish_status", None)
    if not isinstance(publish_status, Mapping):
        return None
    method = str(request.get("REQUEST_METHOD", "")).upper()
    if publish_status.get(method) is not ApiPublishStatus.PUBLIC:
        return None
    return _Request(method=method, route=match.route)


def _json_body_schema(documented: Mapping[str, Any]) -> Any | None:
    media = (documented.get("content") or {}).get("application/json")
    if not isinstance(media, Mapping):
        return None
    return media.get("schema")


def _body_problem(response: HttpResponseBase, validator: OAS30ReadValidator) -> str | None:
    content_type = response.get("Content-Type", "")
    if not content_type.startswith("application/json"):
        return f"expected a JSON body, got {content_type or 'no Content-Type'}"
    try:
        body = orjson.loads(response.content)  # type: ignore[attr-defined]  # streaming responses are skipped
    except orjson.JSONDecodeError:
        return "the body is not valid JSON"
    error = best_match(validator.iter_errors(body))
    if error is None:
        return None
    location = "/".join(str(part) for part in error.absolute_path) or "<root>"
    return f"{location}: {error.message}"[:_MAX_DETAIL]


def _check_response(
    schema: Schema, path: str, method: str, operation: Mapping[str, Any], response: HttpResponseBase
) -> Mismatch | None:
    status = response.status_code
    responses: Mapping[str, Any] = operation.get("responses", {})
    documented = responses.get(str(status), responses.get("default"))
    if documented is None and status >= 500:
        # A server error is a bug in the endpoint, not a status clients should handle.
        return None
    if documented is None:
        documented_statuses = ", ".join(sorted(responses)) or "none"
        return Mismatch(
            UNDOCUMENTED_STATUS, method, path, status, f"documented: {documented_statuses}"
        )
    body_schema = _json_body_schema(documented)
    if body_schema is None or getattr(response, "streaming", False):
        return None
    problem = _body_problem(response, schema.validator(path, method, str(status), body_schema))
    if problem is None:
        return None
    return Mismatch(BODY_MISMATCH, method, path, status, problem)


class MismatchRecord(TypedDict):
    count: int
    detail: str
    test: str


class Report(TypedDict):
    schema_error: str | None
    checked: int
    unchecked: int
    not_in_schema: dict[str, int]
    mismatches: dict[str, MismatchRecord]


def _current_test() -> str:
    return os.environ.get("PYTEST_CURRENT_TEST", "").rsplit(" ", 1)[0]


class Collector:
    """Collects mismatches for one process; the pytest plugin merges the xdist workers."""

    def __init__(
        self,
        baseline: frozenset[str],
        strict: bool = False,
        load_schema: Callable[[], Schema] = lambda: Schema.load(SCHEMA_PATH),
    ) -> None:
        self.baseline = baseline
        self.strict = strict
        self._load_schema = load_schema
        self.schema_error: str | None = None
        self.checked = 0
        # Public responses left unchecked because the schema could not be loaded.
        self.unchecked = 0
        self.not_in_schema: Counter[str] = Counter()
        self.mismatches: dict[str, MismatchRecord] = {}

    @cached_property
    def _schema(self) -> tuple[Schema, _RouteMapper] | None:
        try:
            schema = self._load_schema()
        except FileNotFoundError:
            self.schema_error = (
                f"{SCHEMA_PATH.relative_to(REPO_ROOT)} is missing; build it with "
                "`make build-api-docs`"
            )
            return None
        except (OSError, ValueError, KeyError, IndexError, TypeError) as exc:
            self.schema_error = (
                f"{SCHEMA_PATH.relative_to(REPO_ROOT)} could not be read ({exc!r}); "
                "rebuild it with `make build-api-docs`"
            )
            return None
        return schema, _RouteMapper(schema.base_path)

    def observe(self, response: HttpResponseBase) -> None:
        request = _public_request(response)
        if request is None:
            return
        loaded = self._schema
        if loaded is None:
            self.unchecked += 1
            return
        schema, map_route = loaded
        path = map_route(request.route)
        operation = schema.operation(path, request.method)
        if operation is None:
            self.not_in_schema[f"{request.method} {path}"] += 1
            return
        self.checked += 1
        mismatch = _check_response(schema, path, request.method, operation, response)
        if mismatch is None:
            return
        record = self.mismatches.setdefault(
            mismatch.key, {"count": 0, "detail": mismatch.detail, "test": _current_test()}
        )
        record["count"] += 1
        if self.strict and mismatch.key not in self.baseline:
            raise AssertionError(
                f"{mismatch.key}: {mismatch.detail}\n"
                "The response doesn't match the OpenAPI schema. Document the status in "
                "`@extend_schema(responses=...)` or fix the body, then rebuild the schema "
                "with `make build-api-docs`."
            )

    def report(self) -> Report:
        return {
            "schema_error": self.schema_error,
            "checked": self.checked,
            "unchecked": self.unchecked,
            "not_in_schema": dict(self.not_in_schema),
            "mismatches": self.mismatches,
        }

    def merge(self, report: Report) -> None:
        self.schema_error = self.schema_error or report["schema_error"]
        self.checked += report["checked"]
        self.unchecked += report["unchecked"]
        self.not_in_schema.update(report["not_in_schema"])
        for key, record in report["mismatches"].items():
            mine = self.mismatches.setdefault(key, {**record, "count": 0})
            mine["count"] += record["count"]

    def new_mismatches(self) -> list[str]:
        return sorted(set(self.mismatches) - self.baseline)


def load_baseline(path: Path = BASELINE_PATH) -> frozenset[str]:
    if not path.exists():
        return frozenset()
    lines = (line.strip() for line in path.read_text().splitlines())
    return frozenset(line for line in lines if line and not line.startswith("#"))


def write_baseline(entries: Iterable[str], path: Path = BASELINE_PATH) -> None:
    path.write_text(_BASELINE_HEADER + "".join(f"{entry}\n" for entry in sorted(set(entries))))


_active: Collector | None = None


def activate(collector: Collector | None) -> None:
    global _active
    _active = collector


def observe(response: HttpResponseBase) -> None:
    if _active is not None:
        _active.observe(response)


class ResponseSchemaReporter:
    """pytest plugin: merges what xdist workers collected and summarizes it."""

    def __init__(self, mode: Mode) -> None:
        self.mode = mode
        self.collector = Collector(load_baseline(), strict=mode is Mode.STRICT)
        activate(self.collector)

    def pytest_unconfigure(self) -> None:
        activate(None)

    def pytest_sessionfinish(self, session: pytest.Session) -> None:
        workeroutput = getattr(session.config, "workeroutput", None)
        if workeroutput is not None:
            workeroutput[_WORKER_OUTPUT_KEY] = orjson.dumps(self.collector.report()).decode()

    @pytest.hookimpl(optionalhook=True)
    def pytest_testnodedown(self, node: Any, error: object) -> None:
        output = getattr(node, "workeroutput", {}).get(_WORKER_OUTPUT_KEY)
        if output is not None:
            self.collector.merge(orjson.loads(output))

    def pytest_terminal_summary(
        self, terminalreporter: TerminalReporter, config: pytest.Config
    ) -> None:
        if hasattr(config, "workeroutput"):
            return
        collector = self.collector
        if collector.unchecked:
            terminalreporter.write_sep("-", "API response schema")
            terminalreporter.line(
                f"Skipped {collector.unchecked} public API responses: {collector.schema_error}"
            )
            return
        if not collector.checked and not collector.not_in_schema:
            return

        REPORT_PATH.parent.mkdir(exist_ok=True)
        REPORT_PATH.write_bytes(
            orjson.dumps(collector.report(), option=orjson.OPT_INDENT_2 | orjson.OPT_SORT_KEYS)
        )

        new = collector.new_mismatches()
        baseline_file = BASELINE_PATH.relative_to(REPO_ROOT)
        terminalreporter.write_sep("-", "API response schema")
        terminalreporter.line(
            f"Checked {collector.checked} public API responses: {len(collector.mismatches)} "
            f"mismatches, {len(new)} not in {baseline_file}. "
            f"Details: {REPORT_PATH.relative_to(REPO_ROOT)}"
        )
        for key in new[:_SHOWN_NEW_MISMATCHES]:
            record = collector.mismatches[key]
            terminalreporter.line(f"  {key}: {record['detail']}  ({record['test']})")
        if len(new) > _SHOWN_NEW_MISMATCHES:
            terminalreporter.line(f"  ... and {len(new) - _SHOWN_NEW_MISMATCHES} more")
        if collector.not_in_schema:
            terminalreporter.line(
                f"{len(collector.not_in_schema)} public operations are missing from the "
                "schema, which may be stale; rebuild it with `make build-api-docs`."
            )
        if self.mode is Mode.UPDATE and new:
            write_baseline(collector.baseline | set(collector.mismatches))
            terminalreporter.line(f"Added {len(new)} entries to {baseline_file}")
