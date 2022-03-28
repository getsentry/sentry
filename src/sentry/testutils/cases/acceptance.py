from __future__ import annotations

from datetime import datetime
from unittest.mock import patch

import pytest
from django.conf import settings
from django.test import TransactionTestCase
from django.utils import timezone

from sentry.utils import json
from sentry.utils.pytest.selenium import Browser


@pytest.mark.usefixtures("browser")
class AcceptanceTestCase(TransactionTestCase):
    browser: Browser

    def setUp(self):
        patcher = patch(
            "django.utils.timezone.now",
            return_value=(datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=timezone.utc)),
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        super().setUp()

    def save_cookie(self, name, value, **params):
        self.browser.save_cookie(name=name, value=value, **params)

    def save_session(self):
        self.session.save()
        self.save_cookie(name=settings.SESSION_COOKIE_NAME, value=self.session.session_key)
        # Forward session cookie to django client.
        self.client.cookies[settings.SESSION_COOKIE_NAME] = self.session.session_key

    def dismiss_assistant(self, which=None):
        if which is None:
            which = ("issue", "issue_stream")
        if isinstance(which, str):
            which = [which]

        for item in which:
            res = self.client.put(
                "/api/0/assistant/?v2",
                content_type="application/json",
                data=json.dumps({"guide": item, "status": "viewed", "useful": True}),
            )
            assert res.status_code == 201, res.content
