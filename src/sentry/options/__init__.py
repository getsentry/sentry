"""
sentry.options
~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from .store import OptionsStore
from .manager import OptionsManager
from .manager import (  # NOQA
    DEFAULT_FLAGS, FLAG_IMMUTABLE, FLAG_NOSTORE, FLAG_STOREONLY,
    FLAG_REQUIRED, FLAG_PRIORITIZE_DISK, FLAG_ALLOW_EMPTY, UnknownOption
)

__all__ = (
    'get', 'set', 'delete', 'register', 'isset', 'lookup_key', 'UnknownOption',
)

# See notes in ``runner.initializer`` regarding lazy cache configuration.
default_store = OptionsStore(cache=None)
default_store.connect_signals()

default_manager = OptionsManager(store=default_store)

# expose public API
get = default_manager.get
set = default_manager.set
delete = default_manager.delete
register = default_manager.register
all = default_manager.all
filter = default_manager.filter
isset = default_manager.isset
lookup_key = default_manager.lookup_key


def load_defaults():
    from .defaults import *  # NOQA
