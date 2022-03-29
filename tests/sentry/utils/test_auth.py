import importlib
from datetime import timedelta
from unittest import TestCase

from django.test import override_settings

import sentry.utils.auth


class TestSsoSession(TestCase):
    def test_expiry_default(self):
        from sentry.utils.auth import SSO_EXPIRY_TIME

        # make sure no accidental changes affect sso timeout
        assert SSO_EXPIRY_TIME == timedelta(hours=20)

    @override_settings(SENTRY_SSO_EXPIRY_SECONDS="20")
    def test_expiry_from_env(self):
        importlib.reload(sentry.utils.auth)
        from sentry.utils.auth import SSO_EXPIRY_TIME

        assert SSO_EXPIRY_TIME == timedelta(seconds=20)
