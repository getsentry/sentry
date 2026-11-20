from django.http import HttpRequest, HttpResponse
from django.urls import include, path
from django.views import View

from sentry.api.api_owners import ApiOwner
from sentry.api.base import Endpoint
from sentry.api.endpoint_owners import (
    EndpointOwner,
    build_owner_map,
    get_endpoint_classes_from_url_patterns,
)
from sentry.replays.endpoints.organization_replay_endpoint import OrganizationReplayEndpoint


class UnownedEndpoint(Endpoint):
    pass


class OwnedBaseEndpoint(Endpoint):
    owner = ApiOwner.ALERTS_MONITORS


class InheritingEndpoint(OwnedBaseEndpoint):
    pass


class OverridingEndpoint(OwnedBaseEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS


class PlainDjangoView(View):
    pass


inner_list_from_resolver = [path("inner/", OwnedBaseEndpoint.as_view())]


def function_view(http_request: HttpRequest) -> HttpResponse:
    return HttpResponse()


def test_owner_inheriting_from_class() -> None:
    rows = build_owner_map([path("test_path/", InheritingEndpoint.as_view())])

    assert len(rows) == 1
    assert rows[0].path == "tests/sentry/api/test_endpoint_owners.py"
    assert rows[0].class_name == "InheritingEndpoint"
    assert rows[0].owner == ApiOwner.ALERTS_MONITORS.value


def test_owner_unowned() -> None:
    rows = build_owner_map([path("test_path/", UnownedEndpoint.as_view())])

    assert len(rows) == 1
    assert rows[0].owner == ApiOwner.UNOWNED.value


# test if an owner is set by both the class itself and by the class its inheriting from
# the closest owner wins
def test_multiple_owners() -> None:
    rows = build_owner_map([path("test_path/", OverridingEndpoint.as_view())])

    assert len(rows) == 1
    assert rows[0].owner == ApiOwner.CODING_WORKFLOWS.value


def test_get_endpoint_from_url_patterns_finds_endpoints() -> None:
    url_patterns = [path(route="test_path/", view=OwnedBaseEndpoint.as_view())]

    assert get_endpoint_classes_from_url_patterns(url_patterns) == [OwnedBaseEndpoint]


def test_get_endpoint_from_url_patterns_from_url_resolvers() -> None:
    url_resolvers = [path(route="test_path/", view=include(inner_list_from_resolver))]
    assert get_endpoint_classes_from_url_patterns(url_resolvers) == [OwnedBaseEndpoint]


def test_get_endpoint_from_url_patterns_skips_function_views() -> None:
    url_patterns = [
        path(route="test_path/", view=function_view),
    ]
    assert get_endpoint_classes_from_url_patterns(url_patterns) == []


def test_get_endpoint_from_url_patterns_skips_non_endpoint_views() -> None:
    url_patterns = [
        path(route="test_path/", view=PlainDjangoView.as_view()),
    ]
    assert get_endpoint_classes_from_url_patterns(url_patterns) == []


def test_get_endpoint_from_url_patterns_lists_a_class_once() -> None:
    url_patterns = [
        path(route="test_path/", view=OwnedBaseEndpoint.as_view()),
        path(route="test2_path/", view=OwnedBaseEndpoint.as_view()),
    ]
    assert get_endpoint_classes_from_url_patterns(url_patterns) == [OwnedBaseEndpoint]


def test_endpoint_owner_rows_sort_by_path_then_class() -> None:
    rows = [
        EndpointOwner(path="src/b.py", class_name="AEndpoint", owner="crons"),
        EndpointOwner(path="src/a.py", class_name="ZEndpoint", owner="crons"),
        EndpointOwner(path="src/a.py", class_name="BEndpoint", owner="crons"),
    ]
    rows.sort()

    assert rows == [
        EndpointOwner(path="src/a.py", class_name="BEndpoint", owner="crons"),
        EndpointOwner(path="src/a.py", class_name="ZEndpoint", owner="crons"),
        EndpointOwner(path="src/b.py", class_name="AEndpoint", owner="crons"),
    ]


def test_build_owner_map_resolves_a_real_inherited_owner() -> None:
    matches = []
    for row in build_owner_map():
        if row.class_name == "OrganizationReplayDetailsEndpoint":
            matches.append(row)

    assert len(matches) == 1
    assert matches[0].owner == OrganizationReplayEndpoint.owner.value


# the map comes back sorted so regenerating it gives the same order every time
def test_build_owner_map_is_sorted() -> None:
    rows = build_owner_map()
    assert rows == sorted(rows)
