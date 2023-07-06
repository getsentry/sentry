from typing import TYPE_CHECKING, Optional, Type

from django import get_version
from django.db import router, transaction
from django.db.transaction import Atomic

if TYPE_CHECKING:
    from sentry.db.models import Model

_default_atomic_impl = transaction.atomic


class MismatchedSiloTransactionError(Exception):
    pass


def _get_db_for_model_if_available(model: Type["Model"]) -> Optional[str]:
    from sentry.db.router import SiloConnectionUnavailableError

    try:
        return router.db_for_write(model)
    except SiloConnectionUnavailableError:
        return None


def siloed_atomic(using: Optional[str] = None, savepoint: bool = True) -> Atomic:
    from sentry.models import ControlOutbox, RegionOutbox
    from sentry.silo import SiloMode

    current_silo_mode = SiloMode.get_current_mode()
    if not using:
        model_to_route_to = RegionOutbox if current_silo_mode == SiloMode.REGION else ControlOutbox
        using = router.db_for_write(model_to_route_to)

    control_db = _get_db_for_model_if_available(ControlOutbox)
    region_db = _get_db_for_model_if_available(RegionOutbox)
    both_silos_route_to_same_db = control_db == region_db

    if both_silos_route_to_same_db or current_silo_mode == SiloMode.MONOLITH:
        pass
    elif using == control_db and SiloMode.get_current_mode() != SiloMode.CONTROL:
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) in Control Mode"
        )
    elif using == region_db and SiloMode.get_current_mode() != SiloMode.REGION:
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) in Region Mode"
        )

    return _default_atomic_impl(using=using, savepoint=savepoint)


def patch_silo_aware_atomic():
    global _default_atomic_impl

    current_django_version = get_version()
    assert current_django_version.startswith("2.2."), (
        "Newer versions of Django have an additional 'durable' parameter in atomic,"
        + " verify the signature before updating the version check."
    )

    _default_atomic_impl = transaction.atomic
    transaction.atomic = siloed_atomic  # type:ignore
