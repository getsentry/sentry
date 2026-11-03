from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypedDict, cast
from unittest import mock

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.urls import re_path
from drf_spectacular.settings import spectacular_settings
from drf_spectacular.utils import extend_schema
from drf_spectacular.validation import validate_schema
from rest_framework import serializers
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint
from sentry.apidocs.hooks import (
    CustomEndpointEnumerator,
    CustomGenerator,
    custom_postprocessing_hook,
    custom_preprocessing_hook,
)
from sentry.apidocs.internal import (
    PATH_ALIASES_EXTENSION,
    PERMISSIONS_EXTENSION,
    PUBLISH_STATUS_EXTENSION,
    UNDOCUMENTED_EXTENSION,
    InternalGenerator,
)
from sentry.apidocs.internal.generator import (
    InternalEndpointEnumerator,
    _Admitted,
    _build,
    _internal_build,
    internal_postprocessing_hook,
    internal_preprocessing_hook,
)
from sentry.apidocs.omissions import sentry_schema_serializer
from sentry.apidocs.utils import SentryApiBuildError, inline_sentry_response_serializer

# The published build writes API ownership stats to a tracked file; tests must not.
no_ownership_file = mock.patch("sentry.apidocs.hooks.__write_ownership_data")

NOTES_REGEX = (
    "^api/0/organizations/(?P<organization_id_or_slug>[^/]+)/"
    "(?:issues|groups)/(?P<issue_id>[^/]+)/(?:notes|comments)/$"
)
PREFIX = "/api/0/organizations/{organization_id_or_slug}"


class Scoped(BasePermission):
    pass


class Impersonated(BasePermission):
    pass


class Staff(BasePermission):
    pass


def _endpoint(
    path: str, status: ApiPublishStatus, permission_classes: tuple[Any, ...] = ()
) -> tuple[Any, Any, str, Any]:
    view_class = type(
        "FakeEndpoint",
        (),
        {
            "owner": ApiOwner.CRONS,
            "publish_status": {"GET": status},
            "servers": None,
            "permission_classes": permission_classes,
        },
    )
    callback = type("FakeCallback", (), {"view_class": view_class})
    return (path, path, "GET", callback)


ENDPOINTS = [
    _endpoint("/api/0/public/", ApiPublishStatus.PUBLIC),
    _endpoint("/api/0/public-experimental/", ApiPublishStatus.PUBLIC_EXPERIMENTAL),
    _endpoint("/api/0/experimental/", ApiPublishStatus.EXPERIMENTAL),
    _endpoint("/api/0/private/", ApiPublishStatus.PRIVATE),
]


def _documented_operation(operation_id: str) -> dict[str, Any]:
    return {
        "tags": ["Events"],
        "description": "Documented",
        "operationId": operation_id,
        "parameters": [],
    }


class TestEnumerator:
    def test_published_build_renders_alternations_as_var(self) -> None:
        assert (
            CustomEndpointEnumerator().get_path_from_regex(NOTES_REGEX)
            == f"{PREFIX}/{{var}}/{{issue_id}}/{{var}}/"
        )

    def test_spells_first_branch_and_records_the_rest(self) -> None:
        with _internal_build():
            path = InternalEndpointEnumerator().get_path_from_regex(NOTES_REGEX)
            build = _build()

        assert path == f"{PREFIX}/issues/{{issue_id}}/notes/"
        assert build.path_aliases == {
            path: [
                f"{PREFIX}/issues/{{issue_id}}/notes/",
                f"{PREFIX}/issues/{{issue_id}}/comments/",
                f"{PREFIX}/groups/{{issue_id}}/notes/",
                f"{PREFIX}/groups/{{issue_id}}/comments/",
            ]
        }
        assert build.public_spellings == {path: f"{PREFIX}/{{var}}/{{issue_id}}/{{var}}/"}

    def test_leaves_alternations_inside_parameters(self) -> None:
        regex = (
            "^api/0/projects/(?P<organization_id_or_slug>[^/]+)/(?P<project_id_or_slug>[^/]+)/"
            "events/(?P<event_id>(?:\\d+|[A-Fa-f0-9-]{32,36}|latest))/$"
        )

        with _internal_build():
            path = InternalEndpointEnumerator().get_path_from_regex(regex)
            assert _build().path_aliases == {}

        assert path == (
            "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/events/{event_id}/"
        )

    def test_runs_only_inside_the_internal_build(self) -> None:
        with pytest.raises(ImproperlyConfigured):
            InternalEndpointEnumerator().get_path_from_regex(NOTES_REGEX)


@no_ownership_file
class TestPreprocessing:
    def test_published_build_admits_published_methods(self, _write: Any) -> None:
        filtered = custom_preprocessing_hook(ENDPOINTS)

        assert [path for path, *_ in filtered] == ["/api/0/public/", "/api/0/public-experimental/"]

    def test_admits_every_method_and_records_its_status(self, _write: Any) -> None:
        with _internal_build():
            filtered = internal_preprocessing_hook(ENDPOINTS)
            publish_status = {key: admitted.status for key, admitted in _build().admitted.items()}

        assert [path for path, *_ in filtered] == [
            "/api/0/public/",
            "/api/0/public-experimental/",
            "/api/0/experimental/",
            "/api/0/private/",
        ]
        assert publish_status == {
            ("/api/0/public/", "get"): ApiPublishStatus.PUBLIC,
            ("/api/0/public-experimental/", "get"): ApiPublishStatus.PUBLIC_EXPERIMENTAL,
            ("/api/0/experimental/", "get"): ApiPublishStatus.EXPERIMENTAL,
            ("/api/0/private/", "get"): ApiPublishStatus.PRIVATE,
        }

    def test_excludes_legacy_issue_routes_by_public_spelling(self, _write: Any) -> None:
        # The exclusions are written against the published build's `{var}` spelling.
        endpoints = [
            _endpoint("/api/0/issues/{issue_id}/", ApiPublishStatus.PUBLIC),
            _endpoint(f"{PREFIX}/issues/{{issue_id}}/", ApiPublishStatus.PUBLIC),
        ]

        with _internal_build():
            _build().public_spellings["/api/0/issues/{issue_id}/"] = "/api/0/{var}/{issue_id}/"
            filtered = internal_preprocessing_hook(endpoints)

        assert [path for path, *_ in filtered] == [f"{PREFIX}/issues/{{issue_id}}/"]

    def test_records_the_classes_composed_permissions_guard_on(self, _write: Any) -> None:
        endpoint = _endpoint(
            "/api/0/tokens/", ApiPublishStatus.PRIVATE, (Scoped & ~Impersonated, Staff | Scoped)
        )

        with _internal_build():
            internal_preprocessing_hook([endpoint])
            admitted = _build().admitted[("/api/0/tokens/", "get")]

        assert admitted.permissions == ("Impersonated", "Scoped", "Staff")


class TestPostprocessing:
    def test_stamps_status_and_skips_reference_checks_on_unpublished(self) -> None:
        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/public/": {"get": _documented_operation("public")},
                # No tag and no description would fail the published checks.
                "/api/0/private/": {"get": {"operationId": "private", "parameters": []}},
            },
        }

        with _internal_build():
            _build().admitted = {
                ("/api/0/public/", "get"): _Admitted(ApiPublishStatus.PUBLIC, ("Scoped",)),
                ("/api/0/private/", "get"): _Admitted(ApiPublishStatus.PRIVATE, ()),
            }
            processed = internal_postprocessing_hook(result, None)

        public = processed["paths"]["/api/0/public/"]["get"]
        private = processed["paths"]["/api/0/private/"]["get"]
        assert (public[PUBLISH_STATUS_EXTENSION], public[PERMISSIONS_EXTENSION]) == (
            "public",
            ["Scoped"],
        )
        # An empty list records that the view declares none, unlike an absent extension.
        assert (private[PUBLISH_STATUS_EXTENSION], private[PERMISSIONS_EXTENSION]) == (
            "private",
            [],
        )

    def test_still_checks_published_operations(self) -> None:
        result = {
            "components": {"schemas": {}},
            "paths": {"/api/0/public/": {"get": {"operationId": "public", "parameters": []}}},
        }

        with _internal_build(), pytest.raises(SentryApiBuildError):
            _build().admitted = {("/api/0/public/", "get"): _Admitted(ApiPublishStatus.PUBLIC, ())}
            internal_postprocessing_hook(result, None)

    def test_stamps_path_aliases(self) -> None:
        notes = f"{PREFIX}/issues/{{issue_id}}/notes/"
        comments = f"{PREFIX}/issues/{{issue_id}}/comments/"
        result = {
            "components": {"schemas": {}},
            "paths": {notes: {"get": {"operationId": "notes", "parameters": []}}},
        }

        with _internal_build():
            _build().path_aliases[notes] = [notes, comments]
            _build().admitted = {(notes, "get"): _Admitted(ApiPublishStatus.PRIVATE, ())}
            processed = internal_postprocessing_hook(result, None)

        assert processed["paths"][notes]["get"][PATH_ALIASES_EXTENSION] == [notes, comments]

    def test_drops_the_parameter_for_a_spelled_out_alternation(self) -> None:
        # Issue endpoints declare `var`, the published build's `{var}` for `(?:issues|groups)`.
        path = f"{PREFIX}/issues/{{issue_id}}/"
        var = {"in": "path", "name": "var", "required": True, "schema": {"type": "string"}}
        issue_id = {
            "in": "path",
            "name": "issue_id",
            "required": True,
            "schema": {"type": "string"},
        }
        result = {
            "components": {"schemas": {}},
            "paths": {path: {"get": {"operationId": "issue", "parameters": [var, issue_id]}}},
        }

        with _internal_build():
            _build().public_spellings[path] = f"{PREFIX}/{{var}}/{{issue_id}}/"
            _build().admitted = {(path, "get"): _Admitted(ApiPublishStatus.PRIVATE, ())}
            processed = internal_postprocessing_hook(result, None)

        assert processed["paths"][path]["get"]["parameters"] == [issue_id]

    def test_published_build_stamps_nothing(self) -> None:
        result = {
            "components": {"schemas": {}},
            "paths": {"/api/0/public/": {"get": _documented_operation("public")}},
        }

        operation = custom_postprocessing_hook(result, None)["paths"]["/api/0/public/"]["get"]

        assert PUBLISH_STATUS_EXTENSION not in operation
        assert PERMISSIONS_EXTENSION not in operation
        assert PATH_ALIASES_EXTENSION not in operation


def test_build_swaps_hooks_and_restores_settings() -> None:
    before = (
        list(spectacular_settings.PREPROCESSING_HOOKS),
        list(spectacular_settings.POSTPROCESSING_HOOKS),
        spectacular_settings.TITLE,
    )

    with _internal_build():
        assert spectacular_settings.PREPROCESSING_HOOKS[0] is internal_preprocessing_hook
        assert internal_postprocessing_hook in spectacular_settings.POSTPROCESSING_HOOKS
        assert custom_preprocessing_hook not in spectacular_settings.PREPROCESSING_HOOKS
        assert custom_postprocessing_hook not in spectacular_settings.POSTPROCESSING_HOOKS

    assert (
        list(spectacular_settings.PREPROCESSING_HOOKS),
        list(spectacular_settings.POSTPROCESSING_HOOKS),
        spectacular_settings.TITLE,
    ) == before


class BoxItem(TypedDict):
    id: str


@sentry_schema_serializer(omit_from_public_schema={"secret": "Not for the public reference."})
class BoxDeclaredItem(TypedDict):
    name: str
    secret: str


@sentry_schema_serializer(deprecate={"legacyName": "Use name instead."})
class BoxPatchSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(help_text="The name.")
    legacyName = serializers.CharField(help_text="The old name.", required=False)


class BoxEndpoint(Endpoint):
    owner = ApiOwner.CRONS
    permission_classes = (Scoped,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PUBLIC,
        "PATCH": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    idempotent_methods = frozenset({"PUT"})

    def get(self, request: Request) -> Response[BoxItem]:
        raise NotImplementedError

    @extend_schema(
        tags=["Events"],
        responses={200: inline_sentry_response_serializer("BoxDeclaredItem", BoxDeclaredItem)},
    )
    def put(self, request: Request) -> Response[BoxItem]:
        """
        Update a box item

        A declared response takes precedence over the annotation.
        """
        raise NotImplementedError

    @extend_schema(request=BoxPatchSerializer)
    def patch(self, request: Request) -> Response[None]:
        raise NotImplementedError

    def post(self, request: Request) -> Response:
        raise NotImplementedError

    def delete(self, request: Request) -> Response:
        raise NotImplementedError


PATTERNS = [re_path(r"^api/0/box/(?:items|things)/$", BoxEndpoint.as_view())]


def _json_schema(operation: dict[str, Any], code: str) -> dict[str, Any]:
    return operation["responses"][code]["content"]["application/json"]["schema"]


@no_ownership_file
def test_internal_build_end_to_end(_write: Any) -> None:
    schema = InternalGenerator(patterns=PATTERNS).get_schema(request=None, public=True)
    cast("Callable[[dict[str, Any]], None]", validate_schema)(schema)

    operations = schema["paths"]["/api/0/box/items/"]
    assert {method: op[PUBLISH_STATUS_EXTENSION] for method, op in operations.items()} == {
        "get": "private",
        "put": "public",
        "patch": "experimental",
        "post": "private",
        "delete": "private",
    }
    assert operations["get"][PATH_ALIASES_EXTENSION] == ["/api/0/box/items/", "/api/0/box/things/"]
    assert operations["get"][PERMISSIONS_EXTENSION] == ["Scoped"]
    # Read from the annotation, and closed: a TypedDict lists every key it carries.
    assert _json_schema(operations["get"], "200") == {"$ref": "#/components/schemas/BoxItem"}
    assert schema["components"]["schemas"]["BoxItem"] == {
        "type": "object",
        "properties": {"id": {"type": "string"}},
        "required": ["id"],
        "additionalProperties": False,
    }
    assert _json_schema(operations["put"], "200") == {
        "$ref": "#/components/schemas/BoxDeclaredItem"
    }
    # Nothing is omitted: the backend sends `secret`, so the internal spec describes it.
    assert schema["components"]["schemas"]["BoxDeclaredItem"]["properties"].keys() == {
        "name",
        "secret",
    }
    assert operations["patch"]["responses"] == {"204": {"description": "No response body"}}
    # Omitting nothing still marks what is deprecated.
    assert schema["components"]["schemas"]["PatchedBoxPatch"]["properties"]["legacyName"] == {
        "type": "string",
        "description": "The old name.",
        "deprecated": True,
    }
    assert _json_schema(operations["post"], "200") == {UNDOCUMENTED_EXTENSION: True}
    assert operations["delete"]["responses"] == {"204": {"description": "No response body"}}


@no_ownership_file
def test_published_build_of_the_same_routes_is_unchanged(_write: Any) -> None:
    with mock.patch.object(
        spectacular_settings, "PREPROCESSING_HOOKS", [custom_preprocessing_hook]
    ):
        schema = CustomGenerator(patterns=PATTERNS).get_schema(request=None, public=True)

    (operations,) = schema["paths"].values()
    assert list(operations) == ["put"]
    assert PUBLISH_STATUS_EXTENSION not in operations["put"]
    assert PERMISSIONS_EXTENSION not in operations["put"]
    declared_item = schema["components"]["schemas"]["BoxDeclaredItem"]
    assert "additionalProperties" not in declared_item
    assert declared_item["properties"].keys() == {"name"}
