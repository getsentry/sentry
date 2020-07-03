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


def skip_for_relay_store(reason):
    """
    Decorator factory will skip marked tests if Relay is enabled.
    A test decorated with @skip_for_relay_store("this test has been moved in relay")
    Will not be executed when the settings SENTRY_USE_RELAY = True
    :param reason: the reason the test should be skipped

    Note: Eventually, when Relay becomes compulsory, tests marked with this decorator will be deleted.
    """

    def decorator(function):
        return pytest.mark.skipif(settings.SENTRY_USE_RELAY, reason=reason)(function)

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
