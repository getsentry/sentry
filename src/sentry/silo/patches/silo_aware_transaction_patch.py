from typing import TYPE_CHECKING, Any, Callable, Optional, Type

from django.db import router, transaction
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.transaction import Atomic

_default_atomic_impl = transaction.atomic
_default_on_commit = transaction.on_commit
_default_get_connection = transaction.get_connection

if TYPE_CHECKING:
    from sentry.db.models import Model


class MismatchedSiloTransactionError(Exception):
    pass


def _get_db_for_model_if_available(model: Type["Model"]) -> Optional[str]:
    from sentry.db.router import SiloConnectionUnavailableError

    try:
        return router.db_for_write(model)
    except SiloConnectionUnavailableError:
        return None


def siloed_atomic(
    using: Optional[str] = None, savepoint: bool = True, durable: bool = False
) -> Atomic:
    using = determine_using_by_silo_mode(using)
    return _default_atomic_impl(using=using, savepoint=savepoint, durable=durable)


def siloed_get_connection(using: Optional[str] = None) -> BaseDatabaseWrapper:
    using = determine_using_by_silo_mode(using)
    return _default_get_connection(using=using)


def siloed_on_commit(func: Callable[..., Any], using: Optional[str] = None) -> None:
    using = determine_using_by_silo_mode(using)
    return _default_on_commit(func, using)


def determine_using_by_silo_mode(using: Optional[str]) -> str:
    from sentry.models import ControlOutbox, RegionOutbox
    from sentry.silo import SiloMode

    current_silo_mode = SiloMode.get_current_mode()
    control_db = _get_db_for_model_if_available(ControlOutbox)
    region_db = _get_db_for_model_if_available(RegionOutbox)

    if not using:
        using = region_db if current_silo_mode == SiloMode.REGION else control_db
        assert using

    both_silos_route_to_same_db = control_db == region_db

    if both_silos_route_to_same_db or current_silo_mode == SiloMode.MONOLITH:
        pass
    elif using == control_db and current_silo_mode != SiloMode.CONTROL:
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) except in Control Mode"
        )

    elif using == region_db and current_silo_mode != SiloMode.REGION:
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) except in Region Mode"
        )
    return using


def patch_silo_aware_atomic():
    global _default_on_commit, _default_get_connection, _default_atomic_impl

    _default_atomic_impl = transaction.atomic
    _default_on_commit = transaction.on_commit
    _default_get_connection = transaction.get_connection

    transaction.atomic = siloed_atomic  # type:ignore
    transaction.on_commit = siloed_on_commit
    transaction.get_connection = siloed_get_connection
