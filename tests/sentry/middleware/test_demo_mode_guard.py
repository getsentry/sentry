from functools import cached_property
from unittest.mock import sentinel

from django.http import HttpResponseRedirect
from django.test import RequestFactory

from sentry.middleware.demo_mode_guard import DemoModeGuardMiddleware
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import region_silo_test
from sentry.users.services.user.service import user_service


@region_silo_test
class DemoModeGuardMiddlewareTestCase(TestCase):
    middleware = DemoModeGuardMiddleware(lambda request: sentinel.response)

    def assert_user_equals(self, request):
        assert request.user == user_service.get_user(user_id=self.user.id)

    @cached_property
    def request(self):
        rv = RequestFactory().get("/")
        rv.session = self.session
        rv.subdomain = None
        return rv

    @override_options({"demo-mode.enabled": True})
    def test_middleware_okay(self):
        demo_org = self.create_organization()
        with override_options({"demo-mode.orgs": [demo_org.id]}):
            self.request.session["activeorg"] = demo_org.slug
            response = self.middleware(self.request)

        # empty session means we logged out
        assert self.request.session.is_empty()

        # SHOULD redirect to welcome page
        assert isinstance(response, HttpResponseRedirect)
        assert response.url == "https://sentry.io/welcome"

    @override_options({"demo-mode.enabled": False})
    def test_middleware_demo_mode_disabled(self):
        demo_org = self.create_organization()
        with override_options({"demo-mode.orgs": [demo_org.id]}):
            self.request.session["activeorg"] = demo_org.slug
            response = self.middleware(self.request)

        # SHOULD NOT log out
        assert not self.request.session.is_empty()

        # SHOULD NOT redirect to welcome page
        assert getattr(response, "url", "") != "https://sentry.io/welcome"

    @override_options({"demo-mode.enabled": True})
    def test_middleware_not_demo_org(self):
        demo_org = self.create_organization()
        self.request.session["activeorg"] = demo_org.slug
        response = self.middleware(self.request)

        # SHOULD NOT log out
        assert not self.request.session.is_empty()

        # SHOULD NOT redirect to welcome page
        assert getattr(response, "url", "") != "https://sentry.io/welcome"

    @override_options({"demo-mode.enabled": True})
    def test_middleware_subdomain(self):
        demo_org = self.create_organization()
        with override_options({"demo-mode.orgs": [demo_org.id]}):
            self.request.subdomain = "test"
            self.request.session["activeorg"] = demo_org.slug
            response = self.middleware(self.request)

        # SHOULD NOT log out
        assert not self.request.session.is_empty()

        # SHOULD NOT redirect to welcome page
        assert getattr(response, "url", "") != "https://sentry.io/welcome"
