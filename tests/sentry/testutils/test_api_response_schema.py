from collections.abc import Mapping
from contextlib import AbstractContextManager
from pathlib import Path
from typing import Any
from unittest import mock

import pytest
from django.http import HttpResponse
from django.urls import resolve

from sentry.testutils import api_response_schema
from sentry.testutils.api_response_schema import (
    Collector,
    Schema,
    _check_response,
    _RouteMapper,
    load_baseline,
    write_baseline,
)
from sentry.testutils.cases import APITestCase

ORGANIZATION_PATH = "/organizations/{organization_id_or_slug}/"
SLUG_BODY = {
    "content": {
        "application/json": {
            "schema": {
                "type": "object",
                "required": ["slug"],
                "properties": {"slug": {"type": "string"}},
            }
        }
    }
}


def _schema(operations: Mapping[str, Mapping[str, Any]]) -> Schema:
    return Schema(
        {
            "servers": [{"url": "https://{region}.sentry.io/api/0"}],
            "paths": {ORGANIZATION_PATH: operations} if operations else {},
        }
    )


def _collector(
    responses: Mapping[str, Any], baseline: frozenset[str] = frozenset(), strict: bool = False
) -> Collector:
    schema = _schema({"get": {"responses": responses}})
    return Collector(baseline, strict=strict, load_schema=lambda: schema)


def _observing(collector: Collector) -> AbstractContextManager[Collector]:
    return mock.patch.object(api_response_schema, "_active", collector)


class APIResponseSchemaTest(APITestCase):
    endpoint = "sentry-api-0-organization-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_documented_success_passes(self) -> None:
        collector = _collector({"200": SLUG_BODY})
        with _observing(collector):
            self.get_success_response(self.organization.slug)

        assert collector.checked == 1
        assert collector.mismatches == {}

    def test_undocumented_status(self) -> None:
        collector = _collector({"200": SLUG_BODY})
        with _observing(collector):
            self.get_error_response("does-not-exist", status_code=404)

        record = collector.mismatches[f"undocumented-status GET {ORGANIZATION_PATH} 404"]
        assert record["count"] == 1
        assert record["detail"] == "documented: 200"
        assert record["test"].endswith("test_undocumented_status")

    def test_body_mismatch(self) -> None:
        integer_slug = {
            "content": {
                "application/json": {
                    "schema": {"type": "object", "properties": {"slug": {"type": "integer"}}}
                }
            }
        }
        collector = _collector({"200": integer_slug})
        with _observing(collector):
            self.get_success_response(self.organization.slug)

        record = collector.mismatches[f"body-mismatch GET {ORGANIZATION_PATH} 200"]
        assert record["detail"].startswith("slug: ")

    def test_status_without_body_schema_checks_only_the_status(self) -> None:
        collector = _collector({"200": {"description": "Success"}})
        with _observing(collector):
            self.get_success_response(self.organization.slug)

        assert collector.checked == 1
        assert collector.mismatches == {}

    def test_non_public_method_is_skipped(self) -> None:
        # DELETE on this endpoint is PRIVATE, so the schema not listing it doesn't matter.
        collector = _collector({"200": SLUG_BODY})
        with _observing(collector):
            self.get_response(self.organization.slug, method="delete")

        assert collector.checked == 0
        assert collector.mismatches == {}
        assert not collector.not_in_schema

    def test_public_operation_missing_from_schema(self) -> None:
        collector = Collector(frozenset(), load_schema=lambda: _schema({}))
        with _observing(collector):
            self.get_success_response(self.organization.slug)

        assert collector.checked == 0
        assert collector.not_in_schema == {f"GET {ORGANIZATION_PATH}": 1}

    def test_strict_fails_on_new_mismatch(self) -> None:
        collector = _collector({"200": SLUG_BODY}, strict=True)
        with _observing(collector):
            with pytest.raises(AssertionError, match="undocumented-status GET"):
                self.get_response("does-not-exist")

    def test_baseline_entry_is_suppressed(self) -> None:
        key = f"undocumented-status GET {ORGANIZATION_PATH} 404"
        collector = _collector({"200": SLUG_BODY}, baseline=frozenset({key}), strict=True)
        with _observing(collector):
            self.get_error_response("does-not-exist", status_code=404)

        assert key in collector.mismatches
        assert collector.new_mismatches() == []

    def test_missing_schema_skips_without_failing(self) -> None:
        def missing() -> Schema:
            raise FileNotFoundError

        collector = Collector(frozenset(), strict=True, load_schema=missing)
        with _observing(collector):
            self.get_success_response(self.organization.slug)
            self.get_success_response(self.organization.slug)

        assert collector.unchecked == 2
        assert collector.checked == 0
        assert collector.schema_error is not None
        assert "make build-api-docs" in collector.schema_error


def test_route_aliases_map_to_the_documented_path() -> None:
    map_route = _RouteMapper("/api/0")

    route = resolve("/api/0/organizations/org-slug/groups/1/").route

    assert map_route(route) == "/organizations/{organization_id_or_slug}/issues/{issue_id}/"


def test_undocumented_server_error_is_not_reported() -> None:
    schema = _schema({"get": {"responses": {"200": SLUG_BODY}}})
    operation = schema.operation(ORGANIZATION_PATH, "GET")
    assert operation is not None

    mismatch = _check_response(
        schema, ORGANIZATION_PATH, "GET", operation, HttpResponse(status=503)
    )

    assert mismatch is None


def test_merge_adds_up_worker_reports() -> None:
    key = f"undocumented-status GET {ORGANIZATION_PATH} 404"
    worker = Collector(frozenset())
    worker.checked = 3
    worker.mismatches[key] = {"count": 2, "detail": "documented: 200", "test": "test_a"}
    controller = Collector(frozenset())
    controller.mismatches[key] = {"count": 1, "detail": "documented: 200", "test": "test_b"}

    controller.merge(worker.report())

    assert controller.checked == 3
    assert controller.mismatches[key] == {"count": 3, "detail": "documented: 200", "test": "test_b"}


def test_baseline_round_trip(tmp_path: Path) -> None:
    path = tmp_path / "baseline.txt"

    write_baseline(["b GET /b/ 400", "a GET /a/ 404", "a GET /a/ 404"], path)

    assert path.read_text().startswith("#")
    assert load_baseline(path) == {"a GET /a/ 404", "b GET /b/ 400"}
