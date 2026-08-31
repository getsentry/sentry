from sentry.templatetags.sentry_react import user_theme_class
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import make_request, make_user_request
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user_option import UserOption


@control_silo_test
class UserThemeClassTest(TestCase):
    def test_prefers_react_config_over_requerying(self) -> None:
        request, _user = make_request()
        context = {
            "request": request,
            "react_config": {"user": {"options": {"theme": "dark"}}},
        }
        with self.assertNumQueries(0):
            assert user_theme_class(context) == "theme-dark"

    def test_falls_back_to_user_option_without_react_config(self) -> None:
        request, user = make_user_request()
        UserOption.objects.set_value(user=user, key="theme", value="light")

        assert user_theme_class({"request": request}) == "theme-light"

    def test_ignores_invalid_react_config_theme(self) -> None:
        request, user = make_user_request()
        UserOption.objects.set_value(user=user, key="theme", value="dark")
        context = {
            "request": request,
            "react_config": {"user": {"options": {"theme": "not-a-theme"}}},
        }

        assert user_theme_class(context) == "theme-dark"

    def test_falls_back_when_react_config_has_no_user(self) -> None:
        request, user = make_user_request()
        UserOption.objects.set_value(user=user, key="theme", value="dark")
        context = {"request": request, "react_config": {"user": None}}

        assert user_theme_class(context) == "theme-dark"
