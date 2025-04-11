import subprocess
import sys

modules = [
    "django.db.models.sql.compiler",
    "sentry.identity.services.identity.impl",
    "sentry.integrations.services.integration.impl",
    "sentry.middleware.integrations.parsers.plugin",
    "sentry.notifications.services.impl",
    "sentry.sentry_apps.services.app.impl",
    "sentry.users.services.user.impl",
    "sentry.users.services.user_option.impl",
]

assert_not_in_sys_modules = "\n".join(f'assert "{module}" not in sys.modules' for module in modules)

assert_in_sys_modules = "\n".join(f'assert "{module}" in sys.modules' for module in modules)

SUBPROCESS_TEST_WGI_WARMUP = f"""
import sys

{assert_not_in_sys_modules}

import sentry.wsgi

{assert_in_sys_modules}

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


SUBPROCESS_TEST_WGI_WARMUP_WITH_SUBDOMAIN = f"""
import sys
from django.conf import settings
from sentry.runner import configure
configure()
settings.ALLOWED_HOSTS = [".test.com"]

import sentry.wsgi
{assert_in_sys_modules}
import django.urls.resolvers
from django.conf import settings
resolver = django.urls.resolvers.get_resolver()
assert resolver._populated is True
for lang, _ in settings.LANGUAGES:
    assert lang in resolver._reverse_dict
"""


def test_wsgi_init_with_subdomain():
    """
    In production, we have settings.ALLOWED_HOSTS set, so override it for this test
    and ensure that the wsgi.py file correctly pre-loads the application it set.
    """
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_WGI_WARMUP_WITH_SUBDOMAIN],
    )
