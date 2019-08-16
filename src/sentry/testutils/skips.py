from __future__ import absolute_import

from django.conf import settings
from six.moves.urllib.parse import urlparse
import os
import socket
import pytest


_service_status = {}


def riak_is_available():
    if "riak" in _service_status:
        return _service_status["riak"]
    try:
        socket.create_connection(("127.0.0.1", 8098), 1.0)
    except socket.error:
        _service_status["riak"] = False
    else:
        _service_status["riak"] = True
    return _service_status["riak"]


requires_riak = pytest.mark.skipif(not riak_is_available(), reason="requires riak server running")


def cassandra_is_available():
    if "cassandra" in _service_status:
        return _service_status["cassandra"]
    try:
        socket.create_connection(("127.0.0.1", 9042), 1.0)
    except socket.error:
        _service_status["cassandra"] = False
    else:
        _service_status["cassandra"] = True
    return _service_status["cassandra"]


requires_cassandra = pytest.mark.skipif(
    not cassandra_is_available(), reason="requires cassandra server running"
)


def snuba_is_available():
    if "snuba" in _service_status:
        return _service_status["snuba"]
    try:
        parsed = urlparse(settings.SENTRY_SNUBA)
        socket.create_connection((parsed.host, parsed.port), 1.0)
    except socket.error:
        _service_status["snuba"] = False
    else:
        _service_status["snuba"] = True
    return _service_status["snuba"]


requires_snuba = pytest.mark.skipif(not snuba_is_available, reason="requires snuba server running")


def xfail_if_not_postgres(reason):
    def decorator(function):
        return pytest.mark.xfail(os.environ.get("TEST_SUITE") != "postgres", reason=reason)(
            function
        )

    return decorator
