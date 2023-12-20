from celery.signals import task_postrun
from django.core.signals import request_finished

from .manager import (
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
    FLAG_SCALAR,
    FLAG_STOREONLY,
    NotWritableReason,
    OptionsManager,
    UnknownOption,
    UpdateChannel,
)
from .store import OptionsStore

__all__ = (
    "FLAG_ADMIN_MODIFIABLE",
    "FLAG_ALLOW_EMPTY",
    "FLAG_BOOL",
    "FLAG_IMMUTABLE",
    "FLAG_MODIFIABLE_BOOL",
    "FLAG_MODIFIABLE_RATE",
    "FLAG_NOSTORE",
    "FLAG_PRIORITIZE_DISK",
    "FLAG_RATE",
    "FLAG_REQUIRED",
    "FLAG_SCALAR",
    "FLAG_STOREONLY",
    "FLAG_AUTOMATOR_MODIFIABLE",
    "FLAG_CREDENTIAL",
    "NotWritableReason",
    "UnknownOption",
    "UpdateChannel",
    "can_update",
    "default_store",
    "delete",
    "get",
    "get_last_update_channel",
    "isset",
    "lookup_key",
    "register",
    "unregister",
    "set",
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
unregister = default_manager.unregister
all = default_manager.all
filter = default_manager.filter
isset = default_manager.isset
lookup_key = default_manager.lookup_key
get_last_update_channel = default_manager.get_last_update_channel
can_update = default_manager.can_update


def load_defaults():
    from sentry.hybridcloud import options  # NOQA

    from . import defaults  # NOQA
