from unittest import mock

from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.web.frontend.error_500 import Error500View


@override_settings(DEBUG=True)
@override_settings(DEBUG_PROPAGATE_EXCEPTIONS=False)
@override_settings(ROOT_URLCONF="sentry.conf.urls")
class TestNoSettingsInDebugView(TestCase):
    def test(self):
        self.client.raise_request_exception = False
        # force an unhandled exception
        with mock.patch.object(Error500View, "dispatch", side_effect=ValueError):
            resp = self.client.get(reverse("error-500"))
        # we should have scrubbed the settings from the output
        assert b"SETTINGS_MODULE" not in resp.content
