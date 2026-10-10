import os
import subprocess
import sys

modules = [
    "django.contrib.messages.storage.fallback",
    "django.contrib.sessions.serializers",
    "django.db.models.sql.compiler",
    "sentry.identity.services.identity.impl",
    "sentry.integrations.services.integration.impl",
    "sentry.notifications.services.impl",
    "sentry.sentry_apps.services.app.impl",
    "sentry.users.services.user.impl",
    "sentry.users.services.user_option.impl",
]

assert_not_in_sys_modules = "\n".join(f'assert "{module}" not in sys.modules' for module in modules)

assert_in_sys_modules = "\n".join(f'assert "{module}" in sys.modules' for module in modules)

SUBPROCESS_TEST_WSGI_WARMUP = f"""
import sys

{assert_not_in_sys_modules}

import sentry.wsgi

{assert_in_sys_modules}

import django.urls.resolvers
from django.conf import settings
resolver = django.urls.resolvers.get_resolver()
assert resolver._populated is True

# Boot left the collector running and froze the boot heap (sentry.runner.boot_gc).
import gc
assert gc.isenabled()
assert gc.get_freeze_count() > 0
"""

# Shaped like a granian fork worker: the master already ran configure(), so
# importing sentry.wsgi must freeze what the warmup loaded on top of it.
SUBPROCESS_TEST_WSGI_AFTER_CONFIGURE = """
import gc

from sentry.runner import configure

configure()
assert gc.isenabled()
frozen_by_configure = gc.get_freeze_count()
assert frozen_by_configure > 0

import sentry.wsgi

assert gc.isenabled()
assert gc.get_freeze_count() > frozen_by_configure
"""


def boot_gc_enabled_env() -> dict[str, str]:
    # Pin the boot GC freeze on for the child, whatever the shell exports.
    return {**os.environ, "SENTRY_BOOT_GC_FREEZE": "1"}


def test_wsgi_init() -> None:
    """
    This test ensures that the wsgi.py file correctly pre-loads the application and
    various resources we want to be "warm"
    """
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_WSGI_WARMUP],
        env=boot_gc_enabled_env(),
    )


def test_wsgi_warmup_is_frozen_after_configure() -> None:
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_WSGI_AFTER_CONFIGURE],
        env=boot_gc_enabled_env(),
    )
