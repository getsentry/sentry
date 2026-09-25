import pytest
from django.test import RequestFactory

from sentry.api.scope_version import get_scope_version, record_scope_version


@pytest.mark.parametrize(
    ("granted", "expected"),
    [
        (["org:read"], "v1"),
        (["project:read"], "v1"),
        (["member:read"], "v1"),
        (["org:read", "dashboard:read"], "v1"),
        (["dashboard:read"], "v2"),
        (["org:write", "project:write"], "v2"),
        ([], "v2"),
    ],
)
def test_record_scope_version(granted: list[str], expected: str) -> None:
    request = RequestFactory().get("/")
    record_scope_version(request, granted)
    assert get_scope_version(request) == expected


def test_nothing_recorded() -> None:
    assert get_scope_version(RequestFactory().get("/")) is None
