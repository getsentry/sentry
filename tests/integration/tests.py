# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

from sentry.utils.compat import mock
from django.conf import settings

from sentry.testutils import TestCase
from sentry.utils.settings import validate_settings, ConfigurationError, import_string

DEPENDENCY_TEST_DATA = {
    "postgresql": (
        "DATABASES",
        "psycopg2.extensions",
        "database engine",
        "django.db.backends.postgresql_psycopg2",
        {
            "default": {
                "ENGINE": "django.db.backends.postgresql_psycopg2",
                "NAME": "test",
                "USER": "root",
                "PASSWORD": "",
                "HOST": "127.0.0.1",
                "PORT": "",
            }
        },
    ),
    "memcache": (
        "CACHES",
        "memcache",
        "caching backend",
        "django.core.cache.backends.memcached.MemcachedCache",
        {
            "default": {
                "BACKEND": "django.core.cache.backends.memcached.MemcachedCache",
                "LOCATION": "127.0.0.1:11211",
            }
        },
    ),
    "pylibmc": (
        "CACHES",
        "pylibmc",
        "caching backend",
        "django.core.cache.backends.memcached.PyLibMCCache",
        {
            "default": {
                "BACKEND": "django.core.cache.backends.memcached.PyLibMCCache",
                "LOCATION": "127.0.0.1:11211",
            }
        },
    ),
}


class DependencyTest(TestCase):
    def raise_import_error(self, package):
        def callable(package_name):
            if package_name != package:
                return import_string(package_name)
            raise ImportError("No module named %s" % (package,))

        return callable

    @mock.patch("django.conf.settings", mock.Mock())
    @mock.patch("sentry.utils.settings.import_string")
    def validate_dependency(
        self, key, package, dependency_type, dependency, setting_value, import_string
    ):
        import_string.side_effect = self.raise_import_error(package)

        with self.settings(**{key: setting_value}):
            with self.assertRaises(ConfigurationError):
                validate_settings(settings)

    def test_validate_fails_on_postgres(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA["postgresql"])

    def test_validate_fails_on_memcache(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA["memcache"])

    def test_validate_fails_on_pylibmc(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA["pylibmc"])
