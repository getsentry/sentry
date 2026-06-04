from unittest.mock import patch

from sentry.demo_mode.utils import get_demo_org, get_demo_user, is_demo_org, is_demo_user
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@override_options({"demo-mode.enabled": True, "demo-mode.users": []})
@django_db_all
def test_is_demo_user_demo_mode_enabled_none() -> None:
    assert not is_demo_user(None)


@django_db_all
def test_is_demo_user_demo_mode_enabled_readonly_user() -> None:
    user = Factories.create_user()
    with override_options({"demo-mode.enabled": True, "demo-mode.users": [user.id]}):
        assert is_demo_user(user)


@django_db_all
def test_is_demo_user_demo_mode_enabled_non_readonly_user() -> None:
    user = Factories.create_user()
    with override_options({"demo-mode.enabled": True, "demo-mode.users": []}):
        assert not is_demo_user(user)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_demo_user_demo_mode_disabled_none() -> None:
    assert not is_demo_user(None)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_demo_user_demo_mode_disabled_readonly_user() -> None:
    user = Factories.create_user()
    assert not is_demo_user(user)


@django_db_all
def test_is_demo_user_demo_mode_disabled_non_readonly_user() -> None:
    user = Factories.create_user()
    with override_options({"demo-mode.enabled": False, "demo-mode.users": []}):
        assert not is_demo_user(user)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_is_demo_org_demo_mode_disabled() -> None:
    organization = Factories.create_organization()
    assert not is_demo_org(organization)


@override_options({"demo-mode.enabled": True})
@django_db_all
def test_is_demo_org_no_organization() -> None:
    assert not is_demo_org(None)


@django_db_all
def test_is_demo_org_demo_mode_enabled() -> None:
    organization = Factories.create_organization()
    with override_options({"demo-mode.enabled": True, "demo-mode.orgs": [organization.id]}):
        assert is_demo_org(organization)


@django_db_all
def test_is_demo_org_not_in_demo_orgs() -> None:
    organization = Factories.create_organization()
    with override_options({"demo-mode.enabled": True, "demo-mode.orgs": []}):
        assert not is_demo_org(organization)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_get_demo_user_demo_mode_disabled() -> None:
    assert get_demo_user() is None


@django_db_all
def test_get_demo_user_demo_mode_enabled() -> None:
    user = Factories.create_user()
    with override_options({"demo-mode.enabled": True, "demo-mode.users": [user.id]}):
        with patch("sentry.demo_mode.utils.User.objects.get", return_value=user) as mock_user_get:
            assert get_demo_user() == user
            mock_user_get.assert_called_once_with(id=user.id)


@override_options({"demo-mode.enabled": False})
@django_db_all
def test_get_demo_org_demo_mode_disabled() -> None:
    assert get_demo_org() is None


@django_db_all
def test_get_demo_org_demo_mode_enabled() -> None:
    org = Factories.create_organization()
    with override_options({"demo-mode.enabled": True, "demo-mode.orgs": [org.id]}):
        with patch(
            "sentry.demo_mode.utils.Organization.objects.get", return_value=org
        ) as mock_org_get:
            assert get_demo_org() == org
            mock_org_get.assert_called_once_with(id=org.id)
