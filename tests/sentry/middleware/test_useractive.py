from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from django.test import RequestFactory
from exam import fixture

from sentry.middleware.user import UserActiveMiddleware
from sentry.testutils import TestCase


class UserActiveMiddlewareTest(TestCase):
    middleware = fixture(UserActiveMiddleware)
    factory = fixture(RequestFactory)

    def test_simple(self):
        self.view = lambda x: None

        user = self.user
        req = self.factory.get("/")
        req.user = user

        resp = self.middleware.process_view(req, self.view, [], {})
        assert resp is None
        assert timezone.now() - user.last_active < timedelta(minutes=1)

        user.last_active = None
        resp = self.middleware.process_view(req, self.view, [], {})
        assert resp is None
        assert timezone.now() - user.last_active < timedelta(minutes=1)
