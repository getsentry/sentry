from __future__ import absolute_import

from django.conf import settings
from six.moves.urllib.parse import urlparse
import os
import socket
import pytest


_service_status = {}


def snuba_is_available():
    if "snuba" in _service_status:
        return _service_status["snuba"]
    try:
        parsed = urlparse(settings.SENTRY_SNUBA)
        socket.create_connection((parsed.hostname, parsed.port), 1.0)
    except socket.error:
        _service_status["snuba"] = False
    else:
        _service_status["snuba"] = True
    return _service_status["snuba"]


requires_snuba = pytest.mark.skipif(
    not snuba_is_available(), reason="requires snuba server running"
)


def xfail_if_not_postgres(reason):
    def decorator(function):
        return pytest.mark.xfail(os.environ.get("TEST_SUITE") != "postgres", reason=reason)(
            function
        )

    return decorator


def relay_is_available():
    if "relay" in _service_status:
        return _service_status["relay"]
    try:
        socket.create_connection(("127.0.0.1", settings.SENTRY_RELAY_PORT), 1.0)
    except socket.error:
        _service_status["relay"] = False
    else:
        _service_status["relay"] = True
    return _service_status["relay"]


requires_relay = pytest.mark.skipif(
    not relay_is_available(), reason="requires relay server running"
)
