from collections.abc import Iterator
from typing import Any
from unittest import TestCase
from unittest.mock import patch

import pytest
from drf_spectacular.settings import patched_settings

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint
from sentry.api.endpoints.organization_api_key_index import OrganizationApiKeyIndexEndpoint
from sentry.apidocs.hooks import (
    _ENDPOINT_SERVERS,
    _EXPERIMENTAL_OPERATIONS,
    _OPERATION_SILOS,
    EXPERIMENTAL_NOTICE,
    CustomEndpointEnumerator,
    _fix_nullable_enums,
    custom_postprocessing_hook,
    custom_preprocessing_hook,
)
from sentry.apidocs.utils import SentryApiBuildError
from sentry.core.endpoints.organization_index import OrganizationIndexEndpoint
from sentry.core.endpoints.project_details import ProjectDetailsEndpoint
from sentry.core.endpoints.team_details import TeamDetailsEndpoint
from sentry.investigations.apidocs import investigation_endpoints
from sentry.issues.endpoints.group_details import GroupDetailsEndpoint


@pytest.mark.django_db
def test_investigation_schema_selects_only_private_frontend_routes() -> None:
    with patched_settings({"PREPROCESSING_HOOKS": []}):
        endpoints = CustomEndpointEnumerator().get_api_endpoints()
    selected = investigation_endpoints(endpoints)
    assert selected
    assert all(
        path.startswith("/api/0/organizations/{organization_id_or_slug}/investigations/")
        for path, _regex, _method, _callback in selected
    )
    assert all(
        callback.view_class.publish_status[method] is ApiPublishStatus.PRIVATE
        for _path, _regex, method, callback in selected
    )
    with patch("sentry.apidocs.hooks.__write_ownership_data"):
        published = custom_preprocessing_hook(endpoints)
    assert not {entry[0] for entry in selected}.intersection(entry[0] for entry in published)


class EndpointServersTest(TestCase):
    def setUp(self) -> None:
        _ENDPOINT_SERVERS.clear()

    def tearDown(self) -> None:
        _ENDPOINT_SERVERS.clear()

    def test_servers_applied_to_endpoint(self) -> None:
        """Test that servers from _ENDPOINT_SERVERS are applied to matching paths."""
        _ENDPOINT_SERVERS["/api/0/seer/models/"] = [{"url": "https://{region}.sentry.io"}]

        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/seer/models/": {
                    "get": {
                        "tags": ["Seer"],
                        "description": "Get models",
                        "operationId": "get models",
                        "parameters": [],
                    }
                },
                "/api/0/other/endpoint/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Other endpoint",
                        "operationId": "get other",
                        "parameters": [],
                    }
                },
            },
        }

        processed = custom_postprocessing_hook(result, None)

        # Servers should be applied to the matching endpoint
        assert processed["paths"]["/api/0/seer/models/"]["get"]["servers"] == [
            {"url": "https://{region}.sentry.io"}
        ]
        # Servers should NOT be applied to non-matching endpoint
        assert "servers" not in processed["paths"]["/api/0/other/endpoint/"]["get"]


class PublishStatusFilterTest(TestCase):
    """Only published statuses reach the OpenAPI pipeline, and PUBLIC_EXPERIMENTAL is marked."""

    def setUp(self) -> None:
        _EXPERIMENTAL_OPERATIONS.clear()
        _OPERATION_SILOS.clear()

    def tearDown(self) -> None:
        _ENDPOINT_SERVERS.clear()
        _EXPERIMENTAL_OPERATIONS.clear()
        _OPERATION_SILOS.clear()

    def _endpoint(self, path: str, status: ApiPublishStatus) -> tuple[Any, Any, str, Any]:
        view_class = type(
            "FakeEndpoint",
            (),
            {
                "owner": ApiOwner.CRONS,
                "publish_status": {"GET": status},
                "servers": None,
            },
        )
        callback = type("FakeCallback", (), {"view_class": view_class})
        return (path, path, "GET", callback)

    @patch("sentry.apidocs.hooks.__write_ownership_data")
    def test_only_published_statuses_pass_the_filter(self, _write_ownership: Any) -> None:
        endpoints = [
            self._endpoint("/api/0/public/", ApiPublishStatus.PUBLIC),
            self._endpoint("/api/0/public-experimental/", ApiPublishStatus.PUBLIC_EXPERIMENTAL),
            self._endpoint("/api/0/experimental/", ApiPublishStatus.EXPERIMENTAL),
            self._endpoint("/api/0/private/", ApiPublishStatus.PRIVATE),
        ]

        filtered = custom_preprocessing_hook(endpoints)

        assert [path for path, _regex, _method, _cb in filtered] == [
            "/api/0/public/",
            "/api/0/public-experimental/",
        ]
        assert _EXPERIMENTAL_OPERATIONS == {("/api/0/public-experimental/", "get")}

    def test_experimental_marker_stamped_on_operation(self) -> None:
        _EXPERIMENTAL_OPERATIONS.add(("/api/0/public-experimental/", "get"))

        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/public-experimental/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "An unstable endpoint",
                        "operationId": "get-unstable",
                        "parameters": [],
                    }
                },
                "/api/0/public/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "A stable endpoint",
                        "operationId": "get-stable",
                        "parameters": [],
                    }
                },
            },
        }

        processed = custom_postprocessing_hook(result, None)

        experimental = processed["paths"]["/api/0/public-experimental/"]["get"]
        assert experimental["x-sentry-experimental"] is True
        assert "x-sentry-experimental" not in processed["paths"]["/api/0/public/"]["get"]

        # The docs render the description, not the marker, so the notice is the
        # part a reader actually sees.
        assert experimental["description"] == f"{EXPERIMENTAL_NOTICE}\n\nAn unstable endpoint"
        assert processed["paths"]["/api/0/public/"]["get"]["description"] == "A stable endpoint"


class SummaryUniquenessTest(TestCase):
    def _operation(self, summary: str) -> dict[str, Any]:
        return {
            "tags": ["Events"],
            "description": "An endpoint",
            "operationId": summary.lower().replace(" ", "-"),
            "summary": summary,
            "parameters": [],
        }

    def test_duplicate_summary_raises(self) -> None:
        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/foo/": {"get": self._operation("List Foos")},
                "/api/0/bar/": {"get": self._operation("List Foos")},
            },
        }
        with pytest.raises(SentryApiBuildError):
            custom_postprocessing_hook(result, None)

    def test_unique_summaries_pass(self) -> None:
        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/foo/": {"get": self._operation("List Foos")},
                "/api/0/bar/": {"get": self._operation("List Bars")},
            },
        }
        # Should not raise.
        custom_postprocessing_hook(result, None)


class FixIssueRoutesTest(TestCase):
    def test_issue_route_fixes(self) -> None:
        BEFORE = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/organizations/{organization_id_or_slug}/{var}/{issue_id}/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Get issues",
                        "operationId": "get issue",
                        "parameters": [
                            {
                                "in": "path",
                                "name": "organization_id_or_slug",
                                "schema": {"type": "string"},
                                "description": "The ID or slug of the organization the resource belongs to.",
                                "required": True,
                            },
                            {
                                "in": "path",
                                "name": "var",
                                "schema": {"type": "string"},
                                "description": "Issues or groups",
                                "required": True,
                            },
                        ],
                    }
                },
                "/api/0/{var}/{issue_id}/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Get issues",
                        "operationId": "get issue",
                        "parameters": [
                            {
                                "in": "path",
                                "name": "var",
                                "schema": {"type": "string"},
                                "description": "Issues or groups",
                                "required": True,
                            },
                        ],
                    }
                },
                "/api/0/some/path/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Something else",
                        "operationId": "get something",
                        "parameters": [],
                    }
                },
            },
        }

        # Issue route with /organizations/{organization_id_or_slug}/ should be removed
        # Issue route with /{var}/{issue_id}/ should be renamed to /issues/{issue_id}/
        # "var" and "organization_id_or_slug" path parameters should be removed
        AFTER = {
            "paths": {
                "/api/0/some/path/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Something else",
                        "operationId": "get something",
                        "parameters": [],
                        "x-sentry-routing": {"silo": "unknown"},
                    }
                },
                "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Get issues",
                        "operationId": "get issue",
                        "parameters": [],
                        "x-sentry-routing": {"silo": "unknown"},
                    }
                },
            },
            "components": {"schemas": {}},
        }
        assert custom_postprocessing_hook(BEFORE, None) == AFTER


class UnannotatedRoutingEndpoint(Endpoint):
    owner = ApiOwner.CRONS
    publish_status = {"GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL}


class TestOperationRouting:
    @pytest.fixture(autouse=True)
    def isolate_metadata(self) -> Iterator[None]:
        _ENDPOINT_SERVERS.clear()
        _EXPERIMENTAL_OPERATIONS.clear()
        _OPERATION_SILOS.clear()
        with patch("sentry.apidocs.hooks.__write_ownership_data"):
            yield
        _ENDPOINT_SERVERS.clear()
        _EXPERIMENTAL_OPERATIONS.clear()
        _OPERATION_SILOS.clear()

    def operation(self, parameters: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        return {
            "tags": ["Events"],
            "description": "An endpoint",
            "operationId": "example",
            "parameters": parameters or [],
        }

    def parameter(self, name: str, location: str = "path") -> dict[str, Any]:
        return {"name": name, "in": location, "description": "Organization", "required": True}

    def process(self, paths: dict[str, Any]) -> dict[str, Any]:
        return custom_postprocessing_hook({"components": {"schemas": {}}, "paths": paths}, None)

    @pytest.mark.parametrize(
        ("path", "view", "expected"),
        [
            (
                "/api/0/teams/{organization_id_or_slug}/{team_id_or_slug}/",
                TeamDetailsEndpoint,
                {"silo": "cell", "organizationParameter": "organization_id_or_slug"},
            ),
            (
                "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/",
                ProjectDetailsEndpoint,
                {"silo": "cell", "organizationParameter": "organization_id_or_slug"},
            ),
            ("/api/0/organizations/", OrganizationIndexEndpoint, {"silo": "both"}),
            ("/api/0/unannotated/", UnannotatedRoutingEndpoint, {"silo": "unknown"}),
        ],
    )
    def test_declared_availability(
        self, path: str, view: type[Endpoint], expected: dict[str, str]
    ) -> None:
        endpoint = (path, path, "GET", view.as_view())
        assert custom_preprocessing_hook([endpoint]) == [endpoint]
        result = self.process(
            {path: {"get": self.operation([self.parameter("organization_id_or_slug")])}}
        )
        assert result["paths"][path]["get"]["x-sentry-routing"] == expected

    def test_existing_appended_private_operation_keeps_its_control_annotation(self) -> None:
        path = "/api/0/organizations/{organization_id_or_slug}/api-keys/"
        endpoint = (path, path, "GET", OrganizationApiKeyIndexEndpoint.as_view())

        # Simulate a legacy operation supplied through APPEND_PATHS. Recording
        # routing must not cause preprocessing to publish new private operations.
        assert custom_preprocessing_hook([endpoint]) == []
        result = self.process(
            {path: {"get": self.operation([self.parameter("organization_id_or_slug")])}}
        )
        assert result["paths"][path]["get"]["x-sentry-routing"] == {
            "silo": "control",
            "organizationParameter": "organization_id_or_slug",
        }

    def test_metadata_does_not_leak_between_methods(self) -> None:
        path = "/api/0/teams/{organization_id_or_slug}/{team_id_or_slug}/"
        custom_preprocessing_hook([(path, path, "GET", TeamDetailsEndpoint.as_view())])
        result = self.process({path: {"get": self.operation(), "post": self.operation()}})

        assert result["paths"][path]["get"]["x-sentry-routing"] == {"silo": "cell"}
        assert result["paths"][path]["post"]["x-sentry-routing"] == {"silo": "unknown"}

    @pytest.mark.parametrize(
        ("path", "parameters", "expected"),
        [
            (
                "/api/0/arbitrary/{organization_slug}/",
                [("organization_slug", "path")],
                {"silo": "unknown", "organizationParameter": "organization_slug"},
            ),
            ("/api/0/organizations/", [("organization_id_or_slug", "query")], {"silo": "unknown"}),
            ("/api/0/no-placeholder/", [("organization_slug", "path")], {"silo": "unknown"}),
            ("/api/0/{organization_slug}/", [], {"silo": "unknown"}),
            (
                "/api/0/{organization_slug}/{organization_id_or_slug}/",
                [("organization_slug", "path"), ("organization_id_or_slug", "path")],
                {"silo": "unknown"},
            ),
        ],
    )
    def test_only_unambiguous_real_path_parameters_identify_the_organization(
        self, path: str, parameters: list[tuple[str, str]], expected: dict[str, str]
    ) -> None:
        result = self.process(
            {
                path: {
                    "get": self.operation([self.parameter(*parameter) for parameter in parameters])
                }
            }
        )
        assert result["paths"][path]["get"]["x-sentry-routing"] == expected

    @pytest.mark.parametrize(
        "published_path",
        [
            "/api/0/organizations/{organization_id_or_slug}/{var}/{issue_id}/",
            "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/",
        ],
    )
    def test_issue_alias_and_already_canonical_appended_operation_keep_routing(
        self, published_path: str
    ) -> None:
        source_path = "/api/0/organizations/{organization_id_or_slug}/{var}/{issue_id}/"
        custom_preprocessing_hook(
            [(source_path, source_path, "GET", GroupDetailsEndpoint.as_view())]
        )
        result = self.process(
            {published_path: {"get": self.operation([self.parameter("organization_id_or_slug")])}}
        )
        canonical_path = "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/"
        assert result["paths"][canonical_path]["get"]["x-sentry-routing"] == {
            "silo": "cell",
            "organizationParameter": "organization_id_or_slug",
        }

    def test_excluded_legacy_issue_route_does_not_classify_canonical_route(self) -> None:
        legacy_path = "/api/0/{var}/{issue_id}/"
        assert (
            custom_preprocessing_hook(
                [(legacy_path, legacy_path, "GET", GroupDetailsEndpoint.as_view())]
            )
            == []
        )
        canonical_path = "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/"
        result = self.process({canonical_path: {"get": self.operation()}})
        assert result["paths"][canonical_path]["get"]["x-sentry-routing"] == {"silo": "unknown"}

    def test_experimental_and_routing_metadata_coexist(self) -> None:
        path = "/api/0/example/"
        custom_preprocessing_hook([(path, path, "GET", UnannotatedRoutingEndpoint.as_view())])
        result = self.process({path: {"get": self.operation()}})
        operation = result["paths"][path]["get"]

        assert operation["x-sentry-experimental"] is True
        assert operation["x-sentry-routing"] == {"silo": "unknown"}

    def test_next_schema_build_does_not_reuse_previous_routing(self) -> None:
        path = "/api/0/teams/{organization_id_or_slug}/{team_id_or_slug}/"
        custom_preprocessing_hook([(path, path, "GET", TeamDetailsEndpoint.as_view())])
        first = self.process({path: {"get": self.operation()}})
        assert first["paths"][path]["get"]["x-sentry-routing"] == {"silo": "cell"}

        custom_preprocessing_hook([])
        second = self.process({path: {"get": self.operation()}})
        assert second["paths"][path]["get"]["x-sentry-routing"] == {"silo": "unknown"}


class FixNullableEnumsTest(TestCase):
    def test_adds_null_to_nullable_enum(self) -> None:
        schema = {"enum": ["a", "b"], "type": "string", "nullable": True}
        _fix_nullable_enums(schema)
        assert schema["enum"] == ["a", "b", None]

    def test_does_not_duplicate_null(self) -> None:
        schema = {"enum": ["a", None], "type": "string", "nullable": True}
        _fix_nullable_enums(schema)
        assert schema["enum"] == ["a", None]

    def test_ignores_non_nullable_enum(self) -> None:
        schema = {"enum": ["a", "b"], "type": "string"}
        _fix_nullable_enums(schema)
        assert schema["enum"] == ["a", "b"]

    def test_ignores_nullable_without_enum(self) -> None:
        schema = {"type": "string", "nullable": True}
        _fix_nullable_enums(schema)
        assert schema == {"type": "string", "nullable": True}

    def test_recurses_into_nested_dicts_and_lists(self) -> None:
        result = {
            "components": {
                "schemas": {
                    "Group": {
                        "properties": {
                            "substatus": {
                                "enum": ["ongoing", "new"],
                                "type": "string",
                                "nullable": True,
                            },
                            "status": {
                                "enum": ["resolved", "unresolved"],
                                "type": "string",
                            },
                        }
                    }
                }
            },
            "anyOfExample": [
                {"enum": ["x"], "nullable": True},
                {"type": "object", "nullable": True},
            ],
        }
        _fix_nullable_enums(result)
        # Nullable enums gain null wherever they are nested (deep in dicts and inside
        # lists); the non-nullable enum and the nullable-but-enumless schema are left
        # untouched.
        assert result == {
            "components": {
                "schemas": {
                    "Group": {
                        "properties": {
                            "substatus": {
                                "enum": ["ongoing", "new", None],
                                "type": "string",
                                "nullable": True,
                            },
                            "status": {
                                "enum": ["resolved", "unresolved"],
                                "type": "string",
                            },
                        }
                    }
                }
            },
            "anyOfExample": [
                {"enum": ["x", None], "nullable": True},
                {"type": "object", "nullable": True},
            ],
        }
