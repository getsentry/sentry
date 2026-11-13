from pathlib import Path

import orjson
import pytest
from django.http import HttpResponse

from sentry.testutils.pytest.openapi_responses import Checker, OpenAPIResponseMismatch

SPEC = {
    "paths": {
        "/organizations/{organization_id_or_slug}/issues/{issue_id}/": {
            "get": {
                "operationId": "getIssue",
                "responses": {
                    "200": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["id"],
                                    "properties": {"id": {"type": "string"}},
                                }
                            }
                        }
                    },
                    "404": {"description": "Not found"},
                },
            }
        },
        "/organizations/{organization_id_or_slug}/issues/autofix/": {
            "get": {"operationId": "literal", "responses": {"200": {"description": "ok"}}}
        },
    }
}


@pytest.fixture
def spec_path(tmp_path: Path) -> Path:
    path = tmp_path / "openapi-derefed.json"
    path.write_bytes(orjson.dumps(SPEC))
    return path


def json_response(status: int, body: object) -> HttpResponse:
    return HttpResponse(orjson.dumps(body), status=status, content_type="application/json")


def test_literal_segments_win_over_parameters(spec_path: Path) -> None:
    checker = Checker("report", spec_path)
    operation = checker.index.find("get", "/api/0/organizations/acme/issues/autofix/")
    assert operation is not None
    assert operation.operation_id == "literal"


def test_paths_outside_the_schema_are_skipped(spec_path: Path) -> None:
    checker = Checker("report", spec_path)
    checker.check("/api/0/internal/rpc/user/get_many/", "POST", json_response(200, {}))
    checker.check("/api/0/organizations/acme/issues/1/", "DELETE", json_response(204, {}))
    assert (checker.checked, checker.skipped, checker.findings) == (0, 2, {})


def test_reports_undocumented_status_and_body_drift(spec_path: Path) -> None:
    checker = Checker("report", spec_path)
    path = "/api/0/organizations/acme/issues/1/"
    checker.check(path, "GET", json_response(200, {"id": "1"}))
    checker.check(path, "GET", json_response(404, {"detail": "nope"}))
    checker.check(path, "GET", json_response(402, {"code": "no_budget"}))
    checker.check(path, "GET", json_response(200, {"id": 1}))

    template = "/organizations/{organization_id_or_slug}/issues/{issue_id}/"
    assert sorted(checker.findings) == [
        f"GET {template} 200 body-mismatch",
        f"GET {template} 402 undocumented-status",
    ]
    assert checker.findings[f"GET {template} 200 body-mismatch"].message == (
        "id: 1 is not of type 'string'"
    )


def test_strict_mode_raises(spec_path: Path) -> None:
    checker = Checker("strict", spec_path)
    with pytest.raises(OpenAPIResponseMismatch, match="402 undocumented-status"):
        checker.check("/api/0/organizations/acme/issues/1/", "GET", json_response(402, {}))
