import inspect
import sys

from sentry.utils.imports import import_string

PACKAGES = {
    "django.db.backends.postgresql_psycopg2": "psycopg2.extensions",
    "sentry.db.postgres": "psycopg2.extensions",
    "django.core.cache.backends.memcached.MemcachedCache": "memcache",
    "django.core.cache.backends.memcached.PyLibMCCache": "pylibmc",
}


def reraise_as(new_exception_or_type):
    """
    Obtained from https://github.com/dcramer/reraise/blob/master/src/reraise.py
    >>> try:
    >>>     do_something_crazy()
    >>> except Exception:
    >>>     reraise_as(UnhandledException)
    """
    __traceback_hide__ = True  # NOQA

    e_type, e_value, e_traceback = sys.exc_info()

    if inspect.isclass(new_exception_or_type):
        new_exception = new_exception_or_type()
    else:
        new_exception = new_exception_or_type

    new_exception.__cause__ = e_value

    try:
        raise new_exception.with_traceback(e_traceback)
    finally:
        del e_traceback


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
    except ImportError:
        msg = ConfigurationError.get_error_message(f"{dependency_type} {dependency}", package)
        reraise_as(ConfigurationError(msg))


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
