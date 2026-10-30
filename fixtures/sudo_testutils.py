from __future__ import annotations

from typing import Any

from django.contrib.auth.models import AnonymousUser, User
from django.test import RequestFactory, TestCase


class BaseTestCase(TestCase):
    def setUp(self) -> None:
        self.request = self.get("/foo")
        # RequestFactory requests do not have session middleware applied.
        self.request.session = {}
        self.setUser(AnonymousUser())

    def get(self, *args: Any, **kwargs: Any) -> Any:
        return RequestFactory().get(*args, **kwargs)

    def post(self, *args: Any, **kwargs: Any) -> Any:
        return RequestFactory().post(*args, **kwargs)

    def setUser(self, user: AnonymousUser | User) -> None:
        self.user = self.request.user = user

    def login(self, user_class: type[User] = User) -> None:
        user = user_class()
        self.setUser(user)
