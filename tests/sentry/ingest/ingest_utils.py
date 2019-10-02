from __future__ import absolute_import

import os

import functools
import pytest


def requires_kafka(function):
    @functools.wraps(function)
    def wrapper(*args, **kwargs):
        if "SENTRY_KAFKA_HOSTS" not in os.environ:
            return pytest.xfail(
                "test requires SENTRY_KAFKA_HOSTS environment variable which is not set"
            )
        return function(*args, **kwargs)

    return wrapper
