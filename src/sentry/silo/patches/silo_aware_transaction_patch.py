from typing import Optional

from django.db import router, transaction

_default_atomic_impl = transaction.atomic


class MismatchedSiloTransactionError(Exception):
    pass


def siloed_atomic(using: Optional[str] = None, savepoint: bool = True):
    from sentry.models import ControlOutbox, RegionOutbox
    from sentry.silo import SiloMode

    if not using:
        model_to_route_to = (
            RegionOutbox if SiloMode.get_current_mode() == SiloMode.REGION else ControlOutbox
        )
        using = router.db_for_write(model_to_route_to)

    both_silos_route_to_same_db = router.db_for_write(ControlOutbox) == router.db_for_write(
        RegionOutbox
    )

    current_silo_mode = SiloMode.get_current_mode()
    if both_silos_route_to_same_db or current_silo_mode == SiloMode.MONOLITH:
        pass
    elif (
        using == router.db_for_write(ControlOutbox)
        and SiloMode.get_current_mode() != SiloMode.REGION
    ):
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) in Region Mode"
        )

    elif (
        using == router.db_for_write(RegionOutbox)
        and SiloMode.get_current_mode() != SiloMode.CONTROL
    ):
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) in Control Mode"
        )

    return _default_atomic_impl(using=using, savepoint=savepoint)


def patch_silo_aware_atomic():
    global _default_atomic_impl

    _default_atomic_impl = transaction.atomic
    transaction.atomic = siloed_atomic
