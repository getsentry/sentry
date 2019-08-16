from __future__ import absolute_import

from sentry.mediators.service_hooks import Destroyer
from sentry.models import ServiceHook
from sentry.testutils import TestCase


class TestDestroyer(TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app()
        self.service_hook = self.create_service_hook(application=self.sentry_app.application)
        self.destroyer = Destroyer(service_hook=self.service_hook)

    def test_deletes_service_hook(self):
        service_hook = self.service_hook

        self.destroyer.call()

        assert not ServiceHook.objects.filter(pk=service_hook.id).exists()
