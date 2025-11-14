from typing import int
import subprocess
import sys

modules = [
    "django.contrib.messages.storage.fallback",
    "django.contrib.sessions.serializers",
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


def test_wsgi_init() -> None:
    """
    This test ensures that the wsgi.py file correctly pre-loads the application and
    various resources we want to be "warm"
    """
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_WGI_WARMUP],
    )
