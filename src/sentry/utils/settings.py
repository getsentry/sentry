from sentry.utils.imports import import_string

PACKAGES = {
    "django.db.backends.postgresql_psycopg2": "psycopg2.extensions",
    "sentry.db.postgres": "psycopg2.extensions",
    "django.core.cache.backends.memcached.MemcachedCache": "memcache",
    "django.core.cache.backends.memcached.PyLibMCCache": "pylibmc",
}


def validate_settings(settings):
    for key, engine_key, engine_type in [
        ("DATABASES", "ENGINE", "database engine"),
        ("CACHES", "BACKEND", "caching backend"),
    ]:

        value = getattr(settings, key, {})
        for alias in value:
            engine = value[alias][engine_key]
            if engine not in PACKAGES:
                continue
            validate_dependency(settings, engine_type, engine, PACKAGES[engine])


def validate_dependency(settings, dependency_type, dependency, package):
    try:
        import_string(package)
    except ImportError as e:
        msg = ConfigurationError.get_error_message(f"{dependency_type} {dependency}", package)
        raise ConfigurationError(msg).with_traceback(e.__traceback__)


class ConfigurationError(ValueError):
    """
    This error is thrown whenever a sentry configuration is wrong, or requires a third-party library
    that's not installed properly or can't be found.
    """

    @classmethod
    def get_error_message(cls, dependency, package):
        return (
            """Python could not find %(package)s in your current environment (required by %(dependency)s). If you have it installed, maybe you are using the wrong python binary to run sentry?"""
            % {"dependency": dependency, "package": package}
        )


def is_self_hosted():
    # Backcompat for rename to support old consumers, particularly single-tenant.
    from django.conf import settings

    try:
        return settings.SENTRY_SELF_HOSTED
    except AttributeError:
        return settings.SENTRY_ONPREMISE
