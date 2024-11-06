import subprocess
import sys

SUBPROCESS_TEST_WGI_WARMUP = """
import sys
assert "sentry.conf.urls" not in sys.modules

import sentry.wsgi
assert "sentry.conf.urls" in sys.modules

import django.urls.resolvers
from django.conf import settings
resolver = django.urls.resolvers.get_resolver()
assert resolver._populated is True
for lang, _ in settings.LANGUAGES:
    assert lang in resolver._reverse_dict
"""


def test_wsgi_init():
    """
    This test ensures that the wsgi.py file correctly pre-loads the application and
    various resources we want to be "warm"
    """
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_WGI_WARMUP],
    )
