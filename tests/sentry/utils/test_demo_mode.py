from unittest.mock import patch

from sentry.testutils.factories import Factories
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.demo_mode import get_demo_user, is_demo_org, is_demo_user


@override_options({"demo-mode.enabled": True, "demo-mode.users": [1]})
@django_db_all
def test_is_demo_user_demo_mode_enabled_none():
    assert not is_demo_user(None)


@override_options({"demo-mode.enabled": True, "demo-mode.users": [1]})
@django_db_all
def test_is_demo_user_demo_mode_enabled_readonly_user():
    user = Factories.create_user(id=1)
    assert is_demo_user(user)


@override_options({"demo-mode.enabled": True, "demo-mode.users": [1]})
@django_db_all
def test_is_demo_user_demo_mode_enabled_non_readonly_user():
    user = Factories.create_user(id=2)
    assert not is_demo_user(user)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_demo_user_demo_mode_disabled_none():
    assert not is_demo_user(None)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_demo_user_demo_mode_disabled_readonly_user():
    user = Factories.create_user(id=1)
    assert not is_demo_user(user)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_demo_user_demo_mode_disabled_non_readonly_user():
    user = Factories.create_user(id=2)
    assert not is_demo_user(user)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_demo_org_demo_mode_disabled():
    organization = Factories.create_organization()
    assert not is_demo_org(organization)


@override_options({"demo-mode.enabled": True})
@django_db_all
def test_is_demo_org_no_organization():
    assert not is_demo_org(None)


@override_options({"demo-mode.enabled": True, "demo-mode.orgs": [1, 2, 3]})
@django_db_all
def test_is_demo_org_demo_mode_enabled():
    organization = Factories.create_organization(id=1)
    assert is_demo_org(organization)


@override_options({"demo-mode.enabled": True, "demo-mode.orgs": [1, 2, 3]})
@django_db_all
def test_is_demo_org_not_in_demo_orgs():
    organization = Factories.create_organization(id=4)
    assert not is_demo_org(organization)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_get_demo_user_demo_mode_disabled():
    assert get_demo_user() is None


@override_options({"demo-mode.enabled": True, "demo-mode.users": [1]})
@django_db_all
def test_get_demo_user_demo_mode_enabled():
    user = Factories.create_user(id=1)
    with patch("sentry.utils.demo_mode.User.objects.get", return_value=user) as mock_user_get:
        assert get_demo_user() == user
        mock_user_get.assert_called_once_with(id=1)
