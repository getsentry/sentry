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

# Modules that most requests never need. Each one costs a few MiB of resident memory in every
# web worker, so they load on first use instead of at boot. If one of these shows up after the
# warmup, a module-level import crept back in. Find the importer with
# `python -X importtime -c 'import sentry.wsgi' 2>&1 | grep <module>`.
lazy_modules = [
    "boto3",
    "botocore",
    "google.cloud.devtools.cloudbuild_v1",
    "google.cloud.kms",
    "google.cloud.storage",
    "lxml.html",
    "onelogin",
    "phonenumbers",
    "PIL",
    "psutil",
    "sentry.api.helpers.android_models",
    "sentry.preprod.snapshots.tasks",
    "sentry.relocation.tasks.process",
    "sentry.replays.consumers.recording",
    "tokenizers",
    "toronado",
    "xmlsec",
]

assert_not_in_sys_modules = "\n".join(f'assert "{module}" not in sys.modules' for module in modules)

assert_in_sys_modules = "\n".join(f'assert "{module}" in sys.modules' for module in modules)

assert_lazy_not_loaded = "\n".join(
    f'assert "{module}" not in sys.modules, "{module} must load on first use, not at boot"'
    for module in lazy_modules
)

SUBPROCESS_TEST_WSGI_WARMUP = f"""
import sys

{assert_not_in_sys_modules}

import sentry.wsgi

{assert_in_sys_modules}

{assert_lazy_not_loaded}

from sentry.grouping.enhancer import get_enhancement_bases
assert get_enhancement_bases.cache_info().currsize == 0, "enhancement bases must load on first use"

import django.urls.resolvers
from django.conf import settings
resolver = django.urls.resolvers.get_resolver()
assert resolver._populated is True
"""


def test_wsgi_init() -> None:
    """
    This test ensures that the wsgi.py file correctly pre-loads the application and
    various resources we want to be "warm", and that modules most requests never need
    stay out of the boot.
    """
    subprocess.check_call(
        [sys.executable, "-c", SUBPROCESS_TEST_WSGI_WARMUP],
    )
