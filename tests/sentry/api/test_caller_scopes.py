import pytest

from sentry.api.caller_scopes import has_deprecated_scopes, has_granular_scopes


@pytest.mark.parametrize(
    ("scopes", "deprecated", "granular"),
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
def test_caller_scopes(scopes: list[str], deprecated: bool, granular: bool) -> None:
    assert has_deprecated_scopes(scopes) is deprecated
    assert has_granular_scopes(scopes) is granular
