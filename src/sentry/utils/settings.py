"""
sentry.utils.imports
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.utils.imports import import_string

PACKAGES = {
    'django.db.backends.postgresql_psycopg2': 'psycopg2.extensions',
    'django.db.backends.mysql': 'MySQLdb',
    'django.db.backends.oracle': 'cx_Oracle',
    'django.core.cache.backends.memcached.MemcachedCache': 'memcache',
    'django.core.cache.backends.memcached.PyLibMCCache': 'pylibmc'
}


def validate_settings(settings):
    for key, engine_key, engine_type in \
            [('DATABASES', 'ENGINE', 'database engine'), ('CACHES', 'BACKEND', 'caching backend')]:

        items = settings.get(key, {})

        for item in items.keys():
            engine = items[item][engine_key]
            if engine not in PACKAGES:
                continue
            validate_dependency(settings, engine_type, engine, PACKAGES[engine])


def validate_dependency(settings, dependency_type, dependency, package):
        try:
            import_string(package)
        except ImportError:
            raise ConfigurationError(ConfigurationError.get_error_message("%s %s" % (dependency_type, dependency), package))


class ConfigurationError(ValueError):
    '''
    This error is thrown whenever a sentry configuration is wrong, or requires a third-party library
    that's not installed properly or can't be found.
    '''
    pass

    @classmethod
    def get_error_message(self, dependency, package):
        return """Python could not find %(package)s in your current environment (required by %(dependency)s). If you have it installed, maybe you are using the wrong python binary to run sentry?""" % {"dependency": dependency, "package": package}
