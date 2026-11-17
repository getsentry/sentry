"""Check API test responses against the OpenAPI schema.

Opt in with ``SENTRY_OPENAPI_RESPONSE_CHECK=report`` (collect and summarize) or
``=strict`` (also fail a test that gets a mismatch the baseline doesn't list).

Every response that goes through the Django test client is matched to a public
operation by method and path. Paths and methods missing from the schema aren't
public and are skipped. For a public operation the status must be one of the
documented ``responses`` (S036), and a JSON body must validate against that
status's schema (S037).

The schema is generated from the code in a subprocess while the test workers
start, so it's never stale. ``SENTRY_OPENAPI_SPEC`` points at an already built
``openapi-spectacular.json`` instead.

Findings are keyed (rule, path, scope, key): the endpoint's source file, its
class and method, and the status. That's the API guidelines signature, so the
baseline entries can join that tooling's exceptions.json later. Each process
writes its findings to ``.artifacts/openapi-response-check/report-*.json``, and
``make api-response-baseline`` records them in BASELINE_PATH.
See https://github.com/getsentry/sentry/issues/131073.
"""

from __future__ import annotations

import dataclasses
import functools
import inspect
import os
import re
import subprocess
import sys
import threading
import time
from collections.abc import Callable, Generator
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import orjson
import pytest
from django.test.client import Client
from django.urls import Resolver404
from openapi_schema_validator import OAS30ReadValidator
from referencing import Registry, Resource

ENV_VAR = "SENTRY_OPENAPI_RESPONSE_CHECK"
SPEC_ENV_VAR = "SENTRY_OPENAPI_SPEC"
REPO_ROOT = Path(__file__).resolve().parents[4]
REPORT_DIR = REPO_ROOT / ".artifacts/openapi-response-check"
GENERATED_SPEC = REPORT_DIR / "openapi.json"
GENERATION_FAILED = REPORT_DIR / "openapi.failed"
BASELINE_PATH = REPO_ROOT / "tests/apidocs/openapi-response-baseline.json"
# S035 is taken by a flake8 rule
UNDOCUMENTED_STATUS = "S036"
BODY_MISMATCH = "S037"
UNOWNED = "unowned"

HTTP_METHODS = frozenset({"get", "post", "put", "patch", "delete"})
SPEC_URI = "urn:sentry-openapi"
SPEC_TIMEOUT_SECONDS = 600


def _is_unchecked(status: int) -> bool:
    # A client only gets a 304 when it sends a validator, a 429 can come from any endpoint, and a
    # 5xx is a server bug rather than part of the contract.
    return status == 304 or status == 429 or status >= 500


class OpenAPIResponseMismatch(AssertionError):
    pass


@dataclasses.dataclass(frozen=True)
class Operation:
    template: str
    method: str
    operation_id: str
    responses: dict[str, Any]


@dataclasses.dataclass(frozen=True)
class Endpoint:
    path: str
    scope: str
    owner: str
    line: int


@dataclasses.dataclass
class Finding:
    rule: str
    path: str
    scope: str
    key: str
    owner: str
    line: int
    operation_id: str
    message: str
    test: str
    new: bool

    @property
    def signature(self) -> tuple[str, str, str, str]:
        return (self.rule, self.path, self.scope, self.key)


class SchemaIndex:
    def __init__(self, spec: dict[str, Any]) -> None:
        prefix = urlsplit(spec["servers"][0]["url"]).path.rstrip("/")
        routes: list[tuple[int, int, re.Pattern[str], dict[str, Operation]]] = []
        for template, item in spec["paths"].items():
            ops = {
                method: Operation(template, method, op.get("operationId", ""), op["responses"])
                for method, op in item.items()
                if method in HTTP_METHODS
            }
            regex = re.compile(
                "^" + re.sub(r"\\\{[^}]+\\\}", "[^/]+", re.escape(prefix + template)) + "$"
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


@functools.cache
def endpoint_for(view_class: type, method: str) -> Endpoint:
    """Names an endpoint method the way the API endpoint owner map does."""
    source = Path(inspect.getsourcefile(view_class) or "")
    try:
        path = source.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        path = source.as_posix()
    owner = getattr(view_class, "owner", None)
    return Endpoint(
        path=path,
        scope=f"{view_class.__name__}.{method}",
        owner=getattr(owner, "value", None) or UNOWNED,
        line=_method_line(view_class, method, source),
    )


def _method_line(view_class: type, method: str, source: Path) -> int:
    # silo decorators leave classes inspect can't find the source of, so annotate the method
    handler = inspect.unwrap(getattr(view_class, method, None) or view_class)
    try:
        if Path(inspect.getsourcefile(handler) or "") == source:
            return inspect.getsourcelines(handler)[1]
    except (OSError, TypeError):
        pass
    return 1


def read_baseline(path: Path) -> set[tuple[str, str, str, str]]:
    try:
        entries = orjson.loads(path.read_bytes())["entries"]
    except FileNotFoundError:
        return set()
    return {
        (e["rule"], e["path"], e["scope"], e["key"])
        for e in entries
        if e["rule"] in (UNDOCUMENTED_STATUS, BODY_MISMATCH)
    }


class Checker:
    def __init__(self, spec: dict[str, Any], baseline: set[tuple[str, str, str, str]]) -> None:
        self.index = SchemaIndex(spec)
        self.registry: Registry[Any] = Registry[Any]().with_resource(
            SPEC_URI, Resource.opaque(spec)
        )
        self.baseline = baseline
        self.validators: dict[tuple[str, str, str], Any] = {}
        self.findings: dict[tuple[str, str, str, str], Finding] = {}
        self.exercised: set[tuple[str, str]] = set()
        self.current_test = "<unknown>"
        self.new_in_test: list[Finding] = []
        self.checked = 0
        self.skipped = 0
        self.seconds = 0.0

    def check(self, request_path: str, method: str, response: Any) -> None:
        start = time.perf_counter()
        try:
            self._check(request_path, method.lower(), response)
        finally:
            self.seconds += time.perf_counter() - start

    def _check(self, path: str, method: str, response: Any) -> None:
        operation = self.index.find(method, path)
        view_class = None
        if operation is not None:
            # the client resolves the URL lazily, and a response that never went through URL
            # resolution has no resolver_match at all
            try:
                match = getattr(response, "resolver_match", None)
                view_class = getattr(getattr(match, "func", None), "view_class", None)
            except Resolver404:
                pass
        if operation is None or view_class is None:
            self.skipped += 1
            return
        self.checked += 1

        endpoint = endpoint_for(view_class, method)
        self.exercised.add((endpoint.path, endpoint.scope))
        if _is_unchecked(response.status_code):
            return

        status = str(response.status_code)
        documented = operation.responses.get(status) or operation.responses.get(f"{status[0]}XX")
        if documented is None:
            self._record(
                UNDOCUMENTED_STATUS,
                endpoint,
                operation,
                status,
                f"{method.upper()} {operation.template} returned {status}, documented: "
                + ", ".join(sorted(operation.responses)),
            )
            return

        content_type = response.get("Content-Type", "")
        if (
            "application/json" not in documented.get("content", {})
            or not content_type.startswith("application/json")
            or getattr(response, "streaming", False)
            or not response.content
        ):
            return

        error = next(
            iter(self._validator(operation, status).iter_errors(orjson.loads(response.content))),
            None,
        )
        if error is not None:
            location = "/".join(str(p) for p in error.absolute_path) or "<root>"
            self._record(
                BODY_MISMATCH,
                endpoint,
                operation,
                status,
                f"{method.upper()} {operation.template} {status} body doesn't match the schema "
                f"at {location}: {error.message[:300]}",
            )

    def _validator(self, operation: Operation, status: str) -> Any:
        key = (operation.template, operation.method, status)
        if key not in self.validators:
            template = operation.template.replace("~", "~0").replace("/", "~1")
            pointer = f"/paths/{template}/{operation.method}/responses/{status}/content/application~1json/schema"
            self.validators[key] = OAS30ReadValidator(
                {"$ref": f"{SPEC_URI}#{pointer}"}, registry=self.registry
            )
        return self.validators[key]

    def _record(
        self, rule: str, endpoint: Endpoint, operation: Operation, status: str, message: str
    ) -> None:
        signature = (rule, endpoint.path, endpoint.scope, f"status:{status}")
        finding = self.findings.get(signature)
        if finding is None:
            finding = self.findings[signature] = Finding(
                rule=rule,
                path=endpoint.path,
                scope=endpoint.scope,
                key=signature[3],
                owner=endpoint.owner,
                line=endpoint.line,
                operation_id=operation.operation_id,
                message=message,
                test=self.current_test,
                new=signature not in self.baseline,
            )
        if finding.new:
            self.new_in_test.append(finding)

    def report(self) -> dict[str, Any]:
        return {
            "checked": self.checked,
            "skipped": self.skipped,
            "check_seconds": self.seconds,
            "exercised": sorted(self.exercised),
            "findings": [dataclasses.asdict(f) for f in self.findings.values()],
        }


def bundle_deprecated_docs(path: Path) -> Any:
    """Inlines every $ref of the hand-written docs in api-docs/, like `build-deprecated-docs`."""
    docs: dict[Path, Any] = {}

    def load(file: Path) -> Any:
        if file not in docs:
            docs[file] = orjson.loads(file.read_bytes())
        return docs[file]

    def resolve(node: Any, base: Path, seen: frozenset[tuple[Path, str]]) -> Any:
        if isinstance(node, list):
            return [resolve(item, base, seen) for item in node]
        if not isinstance(node, dict):
            return node
        ref = node.get("$ref")
        if not isinstance(ref, str):
            return {key: resolve(value, base, seen) for key, value in node.items()}
        file, _, fragment = ref.partition("#")
        target = (base.parent / file).resolve() if file else base
        if (target, fragment) in seen:
            return node
        resolved = load(target)
        for part in filter(None, fragment.split("/")):
            resolved = resolved[part.replace("~1", "/").replace("~0", "~")]
        return resolve(resolved, target, seen | {(target, fragment)})

    root = path.resolve()
    return resolve(load(root), root, frozenset())


def generate_spec() -> None:
    """Writes GENERATED_SPEC with drf-spectacular, or GENERATION_FAILED with the reason."""
    deprecated = REPORT_DIR / "openapi-deprecated.json"
    tmp = GENERATED_SPEC.with_suffix(".tmp")
    try:
        deprecated.write_bytes(
            orjson.dumps(bundle_deprecated_docs(REPO_ROOT / "api-docs/openapi.json"))
        )
        result = subprocess.run(
            [sys.executable, "-m", "sentry", "django", "spectacular"]
            + ["--file", str(tmp), "--format", "openapi-json"],
            cwd=REPO_ROOT,
            env={
                # the test settings sentry.py sets up would stop the CLI from configuring itself
                **{
                    k: v
                    for k, v in os.environ.items()
                    if k not in ("_SENTRY_SKIP_CONFIGURATION", "DJANGO_SETTINGS_MODULE")
                },
                "OPENAPIGENERATE": "1",
                "SENTRY_OPENAPI_DEPRECATED_JSON": str(deprecated),
            },
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr[-4000:])
        tmp.rename(GENERATED_SPEC)
    except Exception as e:
        GENERATION_FAILED.write_text(f"{type(e).__name__}: {e}")


def wait_for_spec(path: Path) -> dict[str, Any]:
    deadline = time.monotonic() + SPEC_TIMEOUT_SECONDS
    while not path.exists():
        if GENERATION_FAILED.exists():
            raise RuntimeError(GENERATION_FAILED.read_text())
        if time.monotonic() > deadline:
            raise RuntimeError(f"{path} wasn't written in {SPEC_TIMEOUT_SECONDS}s")
        time.sleep(0.2)
    return orjson.loads(path.read_bytes())


class Plugin:
    def __init__(self, mode: str, spec_path: Path) -> None:
        self.mode = mode
        self.spec_path = spec_path
        self.checker: Checker | None = None
        self.current_test = "<unknown>"
        self.error: str | None = None
        self.spec_seconds = 0.0

    def get_checker(self) -> Checker | None:
        if self.checker is None and self.error is None:
            start = time.perf_counter()
            try:
                spec = wait_for_spec(self.spec_path)
            except RuntimeError as e:
                if self.mode == "strict":
                    raise
                self.error = str(e)
                return None
            self.spec_seconds = time.perf_counter() - start
            self.checker = Checker(spec, read_baseline(BASELINE_PATH))
            self.checker.current_test = self.current_test
        return self.checker

    def wrap(self, request: Callable[..., Any]) -> Callable[..., Any]:
        def wrapper(client: Client, **kwargs: Any) -> Any:
            response = request(client, **kwargs)
            checker = self.get_checker()
            if checker is not None:
                checker.check(
                    kwargs.get("PATH_INFO", ""), kwargs.get("REQUEST_METHOD", ""), response
                )
            return response

        return wrapper

    @pytest.hookimpl(wrapper=True)
    def pytest_runtest_call(self, item: pytest.Item) -> Generator[None, object, object]:
        self.current_test = item.nodeid
        if self.checker is not None:
            self.checker.current_test = item.nodeid
            self.checker.new_in_test = []
        result = yield
        if self.mode == "strict" and self.checker is not None and self.checker.new_in_test:
            raise OpenAPIResponseMismatch(
                "Responses the OpenAPI schema doesn't document. Fix the endpoint or its "
                "@extend_schema, or record them with `make api-response-baseline`:\n"
                + "\n".join(
                    f"  {f.rule} {f.scope} ({f.path}): {f.message}"
                    for f in self.checker.new_in_test
                )
            )
        return result

    def pytest_sessionfinish(self, session: pytest.Session) -> None:
        if self.checker is None:
            return
        workerinput = getattr(session.config, "workerinput", None)
        worker = workerinput["workerid"] if workerinput else "main"
        report = self.checker.report() | {"spec_seconds": self.spec_seconds}
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        (REPORT_DIR / f"report-{worker}.json").write_bytes(orjson.dumps(report))

    def pytest_terminal_summary(self, terminalreporter: Any, config: pytest.Config) -> None:
        if hasattr(config, "workerinput"):
            return
        terminalreporter.section("OpenAPI response check")
        if self.error or GENERATION_FAILED.exists():
            terminalreporter.write_line(
                f"skipped, no schema: {self.error or GENERATION_FAILED.read_text()}"
            )
            return
        reports = [orjson.loads(p.read_bytes()) for p in sorted(REPORT_DIR.glob("report-*.json"))]
        findings: dict[tuple[str, ...], dict[str, Any]] = {}
        for report in reports:
            for f in report["findings"]:
                findings.setdefault((f["rule"], f["path"], f["scope"], f["key"]), f)
        new = [f for f in findings.values() if f["new"]]
        terminalreporter.write_line(
            f"{sum(r['checked'] for r in reports)} responses to public operations checked, "
            f"{sum(r['skipped'] for r in reports)} not in the schema, "
            f"{sum(r['check_seconds'] for r in reports):.2f}s checking, "
            f"{len(findings)} mismatches ({len(new)} not in {BASELINE_PATH.relative_to(REPO_ROOT)})"
        )
        for f in sorted(new, key=lambda f: (f["path"], f["scope"], f["rule"], f["key"])):
            terminalreporter.write_line(
                f"  {f['rule']} {f['scope']} [{f['owner']}]: {f['message']}"
            )
            terminalreporter.write_line(f"      first seen in {f['test']}")
            if os.environ.get("GITHUB_ACTIONS"):
                message = f"{f['message']} (first seen in {f['test']})".replace("\n", " ")
                terminalreporter.write_line(
                    f"::warning file={f['path']},line={f['line']},title={f['rule']} undocumented response::{message}"
                )


def pytest_configure(config: pytest.Config) -> None:
    mode = os.environ.get(ENV_VAR, "")
    if mode not in ("report", "strict"):
        return

    spec_path = Path(os.environ[SPEC_ENV_VAR]) if os.environ.get(SPEC_ENV_VAR) else GENERATED_SPEC
    if not hasattr(config, "workerinput"):
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        for stale in REPORT_DIR.glob("*"):
            stale.unlink()
        if spec_path == GENERATED_SPEC:
            # xdist workers boot while this runs, so it's mostly off the critical path
            threading.Thread(target=generate_spec, daemon=True).start()

    plugin = Plugin(mode, spec_path)
    config.pluginmanager.register(plugin, "openapi-response-check")
    Client.request = plugin.wrap(Client.request)  # type: ignore[method-assign]
