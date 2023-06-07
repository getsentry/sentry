from celery.signals import task_postrun
from django.core.signals import request_finished

from .manager import (  # NOQA
    DEFAULT_FLAGS,
    FLAG_ADMIN_MODIFIABLE,
    FLAG_ALLOW_EMPTY,
    FLAG_AUTOMATOR_MODIFIABLE,
    FLAG_BOOL,
    FLAG_CREDENTIAL,
    FLAG_IMMUTABLE,
    FLAG_MODIFIABLE_BOOL,
    FLAG_MODIFIABLE_RATE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_RATE,
    FLAG_REQUIRED,
    FLAG_STOREONLY,
    OptionsManager,
    UnknownOption,
    UpdateChannel,
)
from .store import OptionsStore

__all__ = (
    "get",
    "set",
    "delete",
    "register",
    "isset",
    "lookup_key",
    "UnknownOption",
    "default_store",
    "get_last_update_channel",
)

# See notes in ``runner.initializer`` regarding lazy cache configuration.
default_store = OptionsStore(cache=None)
task_postrun.connect(default_store.maybe_clean_local_cache)
request_finished.connect(default_store.maybe_clean_local_cache)

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
get_last_update_channel = default_manager.get_last_update_channel


def load_defaults():
    from . import defaults  # NOQA
