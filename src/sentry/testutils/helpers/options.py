from __future__ import absolute_import

__all__ = ['override_options']

from contextlib import contextmanager
from mock import patch


@contextmanager
def override_options(options):
    """
    A context manager for overriding specific configuration
    Options.
    """
    from sentry.options import default_manager
    wrapped = default_manager.store.get

    def new_get(key, **kwargs):
        try:
            return options[key.name]
        except KeyError:
            return wrapped(key, **kwargs)

    with patch.object(default_manager.store, 'get', side_effect=new_get):
        yield
