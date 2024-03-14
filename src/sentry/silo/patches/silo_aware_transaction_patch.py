import re
import traceback
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from django.db import router, transaction
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.transaction import Atomic

from sentry.utils.env import in_test_environment

_default_atomic_impl = transaction.atomic
_default_on_commit = transaction.on_commit
_default_get_connection = transaction.get_connection

if TYPE_CHECKING:
    from sentry.db.models import Model


class MismatchedSiloTransactionError(Exception):
    pass


class TransactionMissingDBException(Exception):
    pass


def _get_db_for_model_if_available(model: type["Model"]) -> str | None:
    from sentry.db.router import SiloConnectionUnavailableError

    try:
        return router.db_for_write(model)
    except SiloConnectionUnavailableError:
        return None


def siloed_atomic(
    using: str | None = None, savepoint: bool = True, durable: bool = False
) -> Atomic:
    validate_transaction_using_for_silo_mode(using)
    return _default_atomic_impl(using=using, savepoint=savepoint, durable=durable)


def siloed_get_connection(using: str | None = None) -> BaseDatabaseWrapper:
    validate_transaction_using_for_silo_mode(using)
    return _default_get_connection(using=using)


def siloed_on_commit(func: Callable[..., Any], using: str | None = None) -> None:
    validate_transaction_using_for_silo_mode(using)
    return _default_on_commit(func, using)


def is_in_test_case_body() -> bool:
    """Determine whether the current execution stack is in a test case body.

    This is a best-effort, potentially brittle implementation that depends on private
    behavior of the current Pytest implementation. We can't necessarily rely on
    underscore-prefixed method names being used in a stable way.

    Are you landing here because test cases regressed mysteriously after a Pytest
    upgrade? Check the list of frames and tweak the condition logic to make this
    function return false as needed. The case `test_is_in_test_case_body` should
    ensure that you aren't making `validate_transaction_using_for_silo_mode` too
    permissive.

    An attempt was also made using Pytest fixtures. We can add state changes around
    the `django_db_setup` fixture, but post-test teardown seems to be too tightly
    coupled to the test run to insert a fixture between them. Adding something to the
    `tearDown()` override in Sentry's BaseTestCase may have worked, but would not
    have helped with standalone test functions. A better solution may nonetheless
    exist; refactoring is encouraged if you find one.

    This should not be used as a general-purpose utility function. Avoid calling it
    in places other than `validate_transaction_using_for_silo_mode` if at all possible.
    """
    frames = [str(frame) for (frame, _) in traceback.walk_stack(None)]

    def seek(module_path: str, function_name: str) -> bool:
        """Check whether the named function has been called in the current stack."""
        pattern = re.compile(rf"/{re.escape(module_path)}\b.*\b{re.escape(function_name)}>$")
        return any(pattern.search(frame) for frame in frames)

    return seek("_pytest/runner.py", "pytest_runtest_call") and not (
        seek("django/test/testcases.py", "_pre_setup")
        or seek("django/test/testcases.py", "_post_teardown")
    )


def validate_transaction_using_for_silo_mode(using: str | None):
    from sentry.models.outbox import ControlOutbox, RegionOutbox
    from sentry.silo import SiloMode

    if using is None:
        raise TransactionMissingDBException("'using' must be specified when creating a transaction")

    if in_test_environment() and not is_in_test_case_body():
        # During setup and teardown of a test environment, allow treating it as one
        # DB. But make sure we enforce as normal during the actual test case.
        return

    current_silo_mode = SiloMode.get_current_mode()
    control_db = _get_db_for_model_if_available(ControlOutbox)
    region_db = _get_db_for_model_if_available(RegionOutbox)

    both_silos_route_to_same_db = control_db == region_db

    if both_silos_route_to_same_db or current_silo_mode == SiloMode.MONOLITH:
        return

    elif using == control_db and current_silo_mode != SiloMode.CONTROL:
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) except in Control Mode"
        )

    elif using == region_db and current_silo_mode != SiloMode.REGION:
        raise MismatchedSiloTransactionError(
            f"Cannot use transaction.atomic({using}) except in Region Mode"
        )


def patch_silo_aware_atomic():
    global _default_on_commit, _default_get_connection, _default_atomic_impl

    _default_atomic_impl = transaction.atomic
    _default_on_commit = transaction.on_commit
    _default_get_connection = transaction.get_connection

    transaction.atomic = siloed_atomic  # type: ignore[assignment]
    transaction.on_commit = siloed_on_commit  # type: ignore[assignment]
    transaction.get_connection = siloed_get_connection
