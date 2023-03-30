from celery.signals import task_postrun
from django.core.signals import request_finished

from sentry.services.hybrid_cloud import silo_mode_delegation, stubbed
from sentry.silo import SiloMode

from .manager import (  # NOQA
    DEFAULT_FLAGS,
    FLAG_ADMIN_MODIFIABLE,
    FLAG_ALLOW_EMPTY,
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
)
from .store import AbstractOptionsStore, OptionsStore

__all__ = (
    "get",
    "set",
    "delete",
    "register",
    "isset",
    "lookup_key",
    "UnknownOption",
    "default_store",
)

# See notes in ``runner.initializer`` regarding lazy cache configuration.
_local_store_impl = OptionsStore(cache=None)


def impl_locally() -> AbstractOptionsStore:
    return _local_store_impl


# An abstraction for hybrid cloud.  Currently, under the hood, all silo modes still use the original options store.
# However, to allow tests to validate abstraction for future silo separation, we need to use a delegator that can,
# eventually, use a new implementation.
default_store: AbstractOptionsStore = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_locally,
        SiloMode.REGION: stubbed(impl_locally, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_locally,
    }
)

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


def load_defaults():
    from . import defaults  # NOQA
