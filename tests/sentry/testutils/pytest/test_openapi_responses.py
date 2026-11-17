from pathlib import Path
from typing import Any
from unittest import mock

import orjson
import pytest
from django.http import HttpResponse
from django.urls import resolve

from sentry.api.api_owners import ApiOwner
from sentry.api.base import Endpoint
from sentry.testutils.pytest.openapi_responses import (
    REPO_ROOT,
    Checker,
    bundle_deprecated_docs,
    read_baseline,
)

ISSUE = "/organizations/{organization_id_or_slug}/issues/{issue_id}/"
ISSUE_ROUTE = "^api/0/organizations/(?P<organization_id_or_slug>[^/]+)/issues/(?P<issue_id>[^/]+)/$"
SPEC: dict[str, Any] = {
    "servers": [{"url": "https://{region}.sentry.io/api/0"}],
    "paths": {
        ISSUE: {
            "get": {
                "operationId": "getIssue",
                "responses": {
                    "200": {
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/Issue"}}
                        }
                    },
                    "404": {"description": "Not found"},
                },
            }
        },
        "/organizations/{organization_id_or_slug}/issues/autofix/": {
            "get": {"operationId": "literal", "responses": {"200": {"description": "ok"}}}
        },
    },
    "components": {
        "schemas": {
            "Issue": {
                "type": "object",
                "required": ["id"],
                "properties": {"id": {"type": "string"}},
            }
        }
    },
}


class IssueEndpoint(Endpoint):
    owner = ApiOwner.ISSUES


SCOPE = (str(Path(__file__).relative_to(REPO_ROOT)), "IssueEndpoint.get")


def response(
    status: int, body: object, view_class: type | None = IssueEndpoint, route: str = ISSUE_ROUTE
) -> HttpResponse:
    resp = HttpResponse(orjson.dumps(body), status=status, content_type="application/json")
    resp.resolver_match = mock.Mock(func=mock.Mock(view_class=view_class), route=route)  # type: ignore[attr-defined]
    return resp


def get(checker: Checker, path: str, resp: HttpResponse) -> None:
    checker.check(path, "GET", resp)


def test_literal_segments_win_over_parameters() -> None:
    operation = Checker(SPEC, set()).index.find("get", "/api/0/organizations/acme/issues/autofix/")
    assert operation is not None
    assert operation.operation_id == "literal"


def test_paths_and_methods_outside_the_schema_are_skipped() -> None:
    checker = Checker(SPEC, set())
    checker.check("/api/0/internal/rpc/user/get_many/", "POST", response(200, {}))
    checker.check("/api/0/organizations/acme/issues/1/", "DELETE", response(204, {}))
    get(checker, "/api/0/organizations/acme/issues/1/", response(500, {}, view_class=None))
    unresolved = response(402, {})
    unresolved.resolver_match = None  # type: ignore[attr-defined]
    get(checker, "/api/0/organizations/acme/issues/1/", unresolved)
    assert (checker.checked, checker.skipped, checker.findings) == (0, 4, {})


@pytest.mark.parametrize(
    "path", ["/api/0/organizations/acme/groups/1/", "/api/0/groups/1/", "/api/0/issues/1/"]
)
def test_alias_paths_are_checked_against_the_documented_operation(path: str) -> None:
    checker = Checker(SPEC, set())
    get(checker, path, response(402, {}, route=resolve(path).route))

    assert (checker.checked, checker.skipped) == (1, 0)
    finding = checker.findings[("S036", *SCOPE, "status:402")]
    assert finding.operation_id == "getIssue"


def test_routes_the_schema_doesnt_document_are_still_skipped() -> None:
    path = "/api/0/organizations/acme/issues/1/hashes/"
    checker = Checker(SPEC, set())
    get(checker, path, response(200, {}, route=resolve(path).route))

    assert (checker.checked, checker.skipped, checker.findings) == (0, 1, {})


def test_reports_undocumented_status_and_body_drift_keyed_by_endpoint_method() -> None:
    checker = Checker(SPEC, set())
    path = "/api/0/organizations/acme/issues/1/"
    get(checker, path, response(200, {"id": "1"}))
    get(checker, path, response(404, {"detail": "nope"}))
    get(checker, path, response(402, {"code": "no_budget"}))
    get(checker, path, response(200, {"id": 1}))

    assert sorted(checker.findings) == [
        ("S036", *SCOPE, "status:402"),
        ("S037", *SCOPE, "status:200"),
    ]
    drift = checker.findings[("S037", *SCOPE, "status:200")]
    assert drift.owner == "issues-feed"
    assert drift.new
    assert drift.message.endswith("at id: 1 is not of type 'string'")
    assert checker.exercised == {SCOPE}


def test_unchecked_statuses() -> None:
    checker = Checker(SPEC, set())
    for status in (304, 429, 500, 504):
        get(checker, "/api/0/organizations/acme/issues/1/", response(status, {}))
    assert checker.findings == {}
    assert checker.exercised == {SCOPE}


def test_baselined_findings_are_not_new() -> None:
    checker = Checker(SPEC, {("S036", *SCOPE, "status:402")})
    get(checker, "/api/0/organizations/acme/issues/1/", response(402, {}))
    get(checker, "/api/0/organizations/acme/issues/1/", response(409, {}))

    assert [f.key for f in checker.new_in_test] == ["status:409"]


def test_read_baseline_keeps_only_runtime_rules(tmp_path: Path) -> None:
    entries = [
        {"rule": "S036", "path": "a.py", "scope": "A.get", "key": "status:402"},
        {"rule": "S026", "path": "a.py", "scope": "A.get", "key": "query:id"},
    ]
    path = tmp_path / "baseline.json"
    path.write_bytes(orjson.dumps({"entries": entries}))

    assert read_baseline(path) == {("S036", "a.py", "A.get", "status:402")}
    assert read_baseline(tmp_path / "missing.json") == set()


def test_bundle_deprecated_docs_inlines_relative_and_local_refs(tmp_path: Path) -> None:
    (tmp_path / "paths").mkdir()
    (tmp_path / "openapi.json").write_text(
        '{"paths": {"/a/": {"$ref": "paths/a.json"}}, "components": {"x": {"type": "string"}}}'
    )
    (tmp_path / "paths/a.json").write_text(
        '{"get": {"schema": {"$ref": "../openapi.json#/components/x"}}}'
    )

    assert bundle_deprecated_docs(tmp_path / "openapi.json")["paths"] == {
        "/a/": {"get": {"schema": {"type": "string"}}}
    }


@pytest.mark.parametrize("mode", ["", "off"])
def test_plugin_is_inert_without_the_env_var(mode: str) -> None:
    from django.test.client import Client

    from sentry.testutils.pytest import openapi_responses

    config = mock.Mock(spec=["pluginmanager"])
    original = Client.request
    with mock.patch.dict("os.environ", {openapi_responses.ENV_VAR: mode}):
        openapi_responses.pytest_configure(config)
    assert Client.request is original
    config.pluginmanager.register.assert_not_called()
