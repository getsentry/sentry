from __future__ import absolute_import

__all__ = ['Feature']

from contextlib import contextmanager
from mock import patch


@contextmanager
def Feature(name, active=True):
    with patch('sentry.features.has') as features_has:
        features_has.side_effect = lambda x, *a, **k: active and x == name
        yield
