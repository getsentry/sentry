from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest
from django.test import RequestFactory, TestCase

from sentry.users.models.user import User


class BaseTestCase(TestCase):
    def setUp(self) -> None:
        self.request = self.get("/foo")
        self.request.session = self.client.session
        self.setUser(AnonymousUser())

    def get(self, *args: Any, **kwargs: Any) -> HttpRequest:
        return RequestFactory().get(*args, **kwargs)

    def post(self, *args: Any, **kwargs: Any) -> HttpRequest:
        return RequestFactory().post(*args, **kwargs)

    def setUser(self, user: AnonymousUser | User) -> None:
        self.user = self.request.user = user

    def login(self, user_class: type[User] = User) -> None:
        user = user_class()
        self.setUser(user)
