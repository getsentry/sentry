from __future__ import annotations

import os
from typing import Any

import pytest

from tools.api_contract_report import (
    build_rows,
    canonical_route,
    classify_return_annotation,
    collect_frontend_routes,
    describe_method,
)


@pytest.mark.parametrize(
    ("route", "expected"),
    (
        ("/organizations/${org.slug}/projects/", "/organizations/*/projects/"),
        ("/organizations/$organizationIdOrSlug/projects/", "/organizations/*/projects/"),
        (
            "/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/",
            "/organizations/*/events/*:*/",
        ),
        ("/projects/${orgSlug}/${projectSlug}/?expand=1", "/projects/*/*/"),
        ("/organizations/", "/organizations/"),
    ),
)
def test_canonical_route(route: str, expected: str) -> None:
    assert canonical_route(route) == expected


@pytest.mark.parametrize(
    ("annotation", "expected"),
    (
        ("Response[ProjectSerializerResponse]", ("typed", "ProjectSerializerResponse")),
        ("Response[list[ProjectSerializerResponse]]", ("typed", "list[ProjectSerializerResponse]")),
        ("Response[dict[str, Any]]", ("loose", "dict[str, Any]")),
        ("Response[Any]", ("loose", "Any")),
        (
            "Response[OrgResponse] | Response[DetailResponse]",
            ("typed", "OrgResponse | DetailResponse"),
        ),
        ("Response[dict[str, Any]] | Response[Any]", ("loose", "dict[str, Any] | Any")),
        ("Response[Foo] | HttpResponse", ("none", "")),
        ("Response", ("none", "")),
        ("HttpResponse", ("none", "")),
        (None, ("none", "")),
    ),
)
def test_classify_return_annotation(annotation: Any, expected: tuple[str, str]) -> None:
    assert classify_return_annotation(annotation) == expected


def test_collect_frontend_routes_only_counts_api_contexts(tmp_path) -> None:
    app = tmp_path / "static" / "app"
    app.mkdir(parents=True)
    (app / "useProjects.tsx").write_text(
        "\n".join(
            [
                "const query = useQuery(",
                "  apiOptions.as<Project[]>()(",
                "    '/organizations/$organizationIdOrSlug/projects/',",
                "    {path: {organizationIdOrSlug: slug}, staleTime: 0}",
                "  )",
                ");",
                "const legacy = useApiQuery<Team[]>([`/organizations/${slug}/teams/`], {});",
                "",
                "",
                "",
                "// a router link far from any API helper, not an API call:",
                "const href = `/organizations/${slug}/issues/`;",
            ]
        )
    )
    (app / "useProjects.spec.tsx").write_text(
        "MockApiClient.addMockResponse({url: '/organizations/org-slug/members/'});"
    )
    (tmp_path / "static" / "gsApp").mkdir()
    (tmp_path / "static" / "gsAdmin").mkdir()

    routes = collect_frontend_routes(os.fspath(tmp_path))

    assert routes == {
        "/organizations/*/projects/": ["static/app/useProjects.tsx:3"],
        "/organizations/*/teams/": ["static/app/useProjects.tsx:7"],
    }


class _Status:
    def __init__(self, value: str) -> None:
        self.value = value


class _Owner:
    value = "owners-team"


def _endpoint(**handlers: Any) -> type:
    namespace: dict[str, Any] = {
        "owner": _Owner(),
        "publish_status": {name.upper(): _Status("private") for name in handlers},
        "__module__": "sentry.api.endpoints.fake",
    }
    namespace.update(handlers)
    return type("FakeEndpoint", (), namespace)


def test_describe_method_prefers_extend_schema_and_annotation() -> None:
    def get(self, request):
        pass

    get.__annotations__["return"] = "Response[FooResponse]"
    setattr(get, "kwargs", {"schema": object()})  # what @extend_schema leaves behind

    def post(self, request):
        pass

    post.__annotations__["return"] = "Response[dict[str, Any]]"

    def delete(self, request):
        pass

    endpoint = _endpoint(get=get, post=post, delete=delete)

    assert describe_method(endpoint, "GET") == ("extend_schema+annotation", "FooResponse")
    assert describe_method(endpoint, "POST") == ("loose", "dict[str, Any]")
    assert describe_method(endpoint, "DELETE") == ("none", "")


def test_build_rows_joins_frontend_calls_to_endpoint_methods() -> None:
    def get(self, request):
        pass

    get.__annotations__["return"] = "Response[list[FooResponse]]"
    endpoint = _endpoint(get=get)
    unused = _endpoint(get=get)

    rows = build_rows(
        [
            ("/organizations/$organizationIdOrSlug/foos/", endpoint),
            ("/organizations/$organizationIdOrSlug/bars/", unused),
        ],
        {"/organizations/*/foos/": ["static/app/a.tsx:1", "static/app/b.tsx:9"]},
    )

    assert [(r.route, r.method, r.contract, r.detail, len(r.call_sites)) for r in rows] == [
        ("/organizations/$organizationIdOrSlug/foos/", "GET", "annotation", "list[FooResponse]", 2)
    ]
    assert rows[0].owner == "owners-team"
    assert rows[0].publish_status == "private"
    assert rows[0].has_contract
