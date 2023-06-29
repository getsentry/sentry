from typing import Optional

from django.db import router, transaction

_default_atomic_impl = transaction.atomic


def siloed_atomic(using: Optional[str] = None, savepoint: bool = True):
    from sentry.models import ControlOutbox, RegionOutbox
    from sentry.silo import SiloMode

    if not using:
        model_to_route_to = (
            RegionOutbox if SiloMode.get_current_mode() == SiloMode.REGION else ControlOutbox
        )
        using = router.db_for_write(model_to_route_to)

    if using == router.db_for_write(ControlOutbox):
        assert (
            SiloMode.get_current_mode() != SiloMode.REGION
        ), f"Cannot use transaction.atomic({using}) in Region Mode"

    if using == router.db_for_write(RegionOutbox):
        assert (
            SiloMode.get_current_mode() != SiloMode.CONTROL
        ), f"Cannot use transaction.atomic({using}) in Control Mode"

    return _default_atomic_impl(using=using, savepoint=savepoint)


def patch_silo_aware_atomic():
    global _default_atomic_impl

    _default_atomic_impl = transaction.atomic
    transaction.atomic = siloed_atomic
