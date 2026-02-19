from django.test import override_settings

from sentry.testutils.cases import TestCase


@override_settings(DEBUG=True)
@override_settings(DEBUG_PROPAGATE_EXCEPTIONS=False)
class TestNoSettingsInDebugView(TestCase):
    def test(self) -> None:
        assert True == False
