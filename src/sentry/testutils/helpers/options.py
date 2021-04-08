__all__ = ["override_options"]

from contextlib import contextmanager

from django.test.utils import override_settings

from sentry.utils.compat.mock import patch


@contextmanager
def override_options(options):
    """
    A context manager for overriding specific configuration
    Options.
    """
    from django.conf import settings

    from sentry.options import default_manager

    wrapped = default_manager.store.get

    def new_get(key, **kwargs):
        try:
            return options[key.name]
        except KeyError:
            return wrapped(key, **kwargs)

    # Patch options into SENTRY_OPTIONS as well
    new_options = settings.SENTRY_OPTIONS.copy()
    new_options.update(options)
    with override_settings(SENTRY_OPTIONS=new_options):
        with patch.object(default_manager.store, "get", side_effect=new_get):
            yield
