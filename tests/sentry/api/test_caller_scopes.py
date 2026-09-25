import pytest
from django.test import RequestFactory

from sentry.api.caller_scopes import (
    has_deprecated_scopes,
    has_granular_scopes,
    record_caller_scopes,
)


@pytest.mark.parametrize(
    ("granted", "deprecated", "granular"),
    [
        (["org:read"], True, False),
        (["project:read"], True, False),
        (["member:read"], True, False),
        (["dashboard:read"], False, True),
        (["org:read", "dashboard:write"], True, True),
        (["org:write", "project:write"], False, False),
        ([], False, False),
    ],
)
def test_record_caller_scopes(granted: list[str], deprecated: bool, granular: bool) -> None:
    request = RequestFactory().get("/")
    record_caller_scopes(request, granted)
    assert has_deprecated_scopes(request) is deprecated
    assert has_granular_scopes(request) is granular


def test_nothing_recorded() -> None:
    request = RequestFactory().get("/")
    assert has_deprecated_scopes(request) is None
    assert has_granular_scopes(request) is None
