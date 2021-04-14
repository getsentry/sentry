from .manager import (  # NOQA
    DEFAULT_FLAGS,
    FLAG_ALLOW_EMPTY,
    FLAG_IMMUTABLE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_REQUIRED,
    FLAG_STOREONLY,
    OptionsManager,
    UnknownOption,
)
from .store import OptionsStore

__all__ = ("get", "set", "delete", "register", "isset", "lookup_key", "UnknownOption")

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
filter = default_manager.filter  # NOQA
isset = default_manager.isset
lookup_key = default_manager.lookup_key


def load_defaults():
    from . import defaults  # NOQA
