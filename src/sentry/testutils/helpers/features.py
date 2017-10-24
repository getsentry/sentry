from __future__ import absolute_import

__all__ = ['Feature']

import six
import collections
from contextlib import contextmanager
from mock import patch


@contextmanager
def Feature(names):
    """
    Control whether a feature is enabled.

    A single feature may be conviniently enabled with

    >>> with Feature('feature-1'):
    >>>   # Executes with feature-1 enabled

    More advanced enabling / disabling can be done using a dict

    >>> with Feature({'feature-1': True, 'feature-2': False}):
    >>>   # Executes with feature-1 enabled and feature-2 disabled

    The following two invocations are equivalent:

    >>> with Feature(['feature-1', 'feature-2']):
    >>>   # execute with both features enabled
    >>> with Feature({'feature-1': True, 'feature-2': True}):
    >>>   # execute with both features enabled
    """
    if isinstance(names, six.string_types):
        names = {names: True}

    elif not isinstance(names, collections.Mapping):
        names = {k: True for k in names}

    with patch('sentry.features.has') as features_has:
        features_has.side_effect = lambda x, *a, **k: names.get(x, False)
        yield
