from typing import Any, cast

from django.contrib.auth.models import AnonymousUser, User
from django.http import HttpRequest
from django.test import RequestFactory, TestCase

from sentry.auth.principal import set_request_principal


class BaseTestCase(TestCase):
    def setUp(self) -> None:
        self.request = self.get("/foo")
        self.request.session = cast("Any", {})
        self.setUser(AnonymousUser())

    def get(self, *args: Any, **kwargs: Any) -> HttpRequest:
        return RequestFactory().get(*args, **kwargs)

    def post(self, *args: Any, **kwargs: Any) -> HttpRequest:
        return RequestFactory().post(*args, **kwargs)

    def setUser(self, user: Any) -> None:
        self.user = user
        set_request_principal(self.request, user, None)

    def login(self, user_class: type[User] = User) -> None:
        user = user_class()
        self.setUser(user)
