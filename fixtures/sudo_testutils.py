from typing import Any, cast

from django.contrib.auth.models import AnonymousUser, User
from django.core.handlers.wsgi import WSGIRequest
from django.test import RequestFactory, TestCase


class BaseTestCase(TestCase):
    request: WSGIRequest
    user: AnonymousUser | User

    def setUp(self) -> None:
        self.request = self.get("/foo")
        self.request.session = cast(Any, {})
        self.setUser(AnonymousUser())

    def get(self, *args: Any, **kwargs: Any) -> WSGIRequest:
        return RequestFactory().get(*args, **kwargs)

    def post(self, *args: Any, **kwargs: Any) -> WSGIRequest:
        return RequestFactory().post(*args, **kwargs)

    def setUser(self, user: AnonymousUser | User) -> None:
        self.user = self.request.user = user

    def login(self, user_class: type[User] = User) -> None:
        user = user_class()
        self.setUser(user)
