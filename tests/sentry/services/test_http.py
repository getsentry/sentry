from __future__ import annotations

from django.test.utils import override_settings

from sentry.services.http import SentryHTTPServer
from sentry.testutils.cases import TestCase


class HTTPServiceTest(TestCase):
    def test_options(self) -> None:
        cls = SentryHTTPServer

        server = cls(host="1.1.1.1", port=80)
        assert server.options["host"] == "1.1.1.1"
        assert server.options["port"] == 80

        with override_settings(SENTRY_WEB_HOST="1.1.1.1", SENTRY_WEB_PORT=80):
            assert server.options["host"] == "1.1.1.1"
            assert server.options["port"] == 80

        server = cls(workers=10)
        assert server.options["workers"] == 10

        options = {
            "host": "1.1.1.1",
            "port": 80,
            "proc-name": "LOL",
            "secure_scheme_headers": {},
            "loglevel": "info",
        }
        with override_settings(SENTRY_WEB_OPTIONS=options):
            server = cls()
            assert server.options["host"] == "1.1.1.1"
            assert server.options["port"] == 80
            assert server.options["proc-name"] == "LOL"

    def test_format_logs(self) -> None:
        with self.options({"system.logging-format": "human"}):
            server = SentryHTTPServer()
            assert server.options["log-enabled"] is True
        with self.options({"system.logging-format": "machine"}):
            server = SentryHTTPServer()
            assert server.options["log-enabled"] is False
