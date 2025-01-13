from sentry.testutils.factories import Factories
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.demo_mode import get_readonly_scopes, is_readonly_user


@override_options({"demo-mode.enabled": True, "demo-mode.users": ["readonly@example.com"]})
@django_db_all
def test_is_readonly_user_demo_mode_enabled_none():
    assert not is_readonly_user(None)


@override_options({"demo-mode.enabled": True, "demo-mode.users": ["readonly@example.com"]})
@django_db_all
def test_is_readonly_user_demo_mode_enabled_readonly_user():
    user = Factories.create_user("readonly@example.com")
    assert is_readonly_user(user)


@override_options({"demo-mode.enabled": True, "demo-mode.users": ["readonly@example.com"]})
@django_db_all
def test_is_readonly_user_demo_mode_enabled_non_readonly_user():
    user = Factories.create_user("user@example.com")
    assert not is_readonly_user(user)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_readonly_user_demo_mode_disabled_none():
    assert not is_readonly_user(None)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_readonly_user_demo_mode_disabled_readonly_user():
    user = Factories.create_user("readonly@example.com")
    assert not is_readonly_user(user)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_readonly_user_demo_mode_disabled_non_readonly_user():
    user = Factories.create_user("user@example.com")
    assert not is_readonly_user(user)


def test_get_readonly_scopes():
    expected_scopes = frozenset(
        [
            "project:read",
            "org:read",
            "event:read",
            "member:read",
            "team:read",
            "project:releases",
            "alerts:read",
        ]
    )
    assert get_readonly_scopes() == expected_scopes
