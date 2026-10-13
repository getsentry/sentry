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

# The boot GC freeze is opt-in: with it unset, boot leaves the collector as
# it always was (sentry.runner.boot_gc).
import gc
assert gc.isenabled()
assert gc.get_freeze_count() == 0
"""

# Shaped like a worker of the granian CLI (`granian ... sentry.wsgi:application`):
# nothing is configured yet, so configure() runs inside the sentry.wsgi window
# and is frozen with the warmup.
SUBPROCESS_TEST_WSGI_COLD = """
import gc

import sentry.wsgi

assert gc.isenabled()
# Not just configure()'s own freeze: the warmup's objects are frozen too, so
# almost nothing is left for the collector to walk.
assert len(gc.get_objects()) < gc.get_freeze_count() // 10
"""

# Shaped like a fork worker of `sentry run web`: the master already ran
# configure(), so importing sentry.wsgi must freeze what the warmup loaded on top
# of it.
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


def env_without_boot_gc_freeze() -> dict[str, str]:
    # The child's setting must not depend on what the shell exports.
    return {k: v for k, v in os.environ.items() if k != "SENTRY_BOOT_GC_FREEZE"}


def test_wsgi_init() -> None:
    """
    This test ensures that the wsgi.py file correctly pre-loads the application and
    various resources we want to be "warm"
    """
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_WSGI_WARMUP],
        env=env_without_boot_gc_freeze(),
    )


def test_wsgi_cold_import_is_frozen() -> None:
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_WSGI_COLD],
        env={**env_without_boot_gc_freeze(), "SENTRY_BOOT_GC_FREEZE": "1"},
    )


def test_wsgi_warmup_is_frozen_after_configure() -> None:
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_WSGI_AFTER_CONFIGURE],
        env={**env_without_boot_gc_freeze(), "SENTRY_BOOT_GC_FREEZE": "1"},
    )
