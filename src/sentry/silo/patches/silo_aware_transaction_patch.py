from typing import Any, Callable, Optional

from django import get_version
from django.db import router, transaction
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.transaction import Atomic

_default_atomic_impl = transaction.atomic
_default_on_commit = transaction.on_commit
_default_get_connection = transaction.get_connection


class MismatchedSiloTransactionError(Exception):
    pass


def siloed_atomic(using: Optional[str] = None, savepoint: bool = True) -> Atomic:
    using = determine_using_by_silo_mode(using)
    return _default_atomic_impl(using=using, savepoint=savepoint)


def siloed_get_connection(using: Optional[str] = None) -> BaseDatabaseWrapper:
    using = determine_using_by_silo_mode(using)
    return _default_get_connection(using=using)


def siloed_on_commit(cb: Callable[..., Any], using: Optional[str] = None) -> None:
    using = determine_using_by_silo_mode(using)
    return _default_on_commit(cb, using)


def determine_using_by_silo_mode(using):
    from sentry.models import ControlOutbox, RegionOutbox
    from sentry.silo import SiloMode

    current_silo_mode = SiloMode.get_current_mode()
    if not using:
        model_to_route_to = RegionOutbox if current_silo_mode == SiloMode.REGION else ControlOutbox
        using = router.db_for_write(model_to_route_to)
    both_silos_route_to_same_db = router.db_for_write(ControlOutbox) == router.db_for_write(
        RegionOutbox
    )
    if both_silos_route_to_same_db or current_silo_mode == SiloMode.MONOLITH:
        pass
    elif (
        using == router.db_for_write(ControlOutbox)
        and SiloMode.get_current_mode() != SiloMode.CONTROL
    ):
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) in Control Mode"
        )

    elif (
        using == router.db_for_write(RegionOutbox)
        and SiloMode.get_current_mode() != SiloMode.REGION
    ):
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) in Region Mode"
        )
    return using


def patch_silo_aware_atomic():
    global _default_atomic_impl, _default_on_commit, _default_get_connection

    current_django_version = get_version()
    assert current_django_version.startswith("2.2."), (
        "Newer versions of Django have an additional 'durable' parameter in atomic,"
        + " verify the signature before updating the version check."
    )

    _default_atomic_impl = transaction.atomic
    _default_on_commit = transaction.on_commit
    _default_get_connection = transaction.get_connection

    transaction.atomic = siloed_atomic  # type:ignore
    transaction.on_commit = siloed_on_commit  # type:ignore
    transaction.get_connection = siloed_get_connection  # type:ignore
