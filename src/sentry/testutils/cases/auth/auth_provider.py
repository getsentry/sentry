from __future__ import annotations

from sentry import auth
from sentry.auth.providers.dummy import DummyProvider

from ..base import TestCase


class AuthProviderTestCase(TestCase):
    provider = DummyProvider
    provider_name = "dummy"

    def setUp(self):
        super().setUp()
        # TestCase automatically sets up dummy provider
        if self.provider_name != "dummy" or self.provider != DummyProvider:
            auth.register(self.provider_name, self.provider)
            self.addCleanup(auth.unregister, self.provider_name, self.provider)
