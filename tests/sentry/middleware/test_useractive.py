from datetime import timedelta
from functools import cached_property

from django.test import RequestFactory
from django.utils import timezone

from sentry.middleware.user import UserActiveMiddleware
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class UserActiveMiddlewareTest(TestCase):
    middleware = cached_property(UserActiveMiddleware)

    @cached_property
    def factory(self):
        return RequestFactory()

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
