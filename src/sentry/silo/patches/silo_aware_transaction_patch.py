import functools
import sys
from collections.abc import Callable
from types import CodeType, FrameType
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
    test_call, setup_teardown = _test_frame_codes()
    in_test_call = False
    frame: FrameType | None = sys._getframe(1)
    while frame is not None:
        if frame.f_code in setup_teardown:
            return False
        in_test_call = in_test_call or frame.f_code is test_call
        frame = frame.f_back
    return in_test_call


@functools.cache
def _test_frame_codes() -> tuple[CodeType, frozenset[CodeType]]:
    # Imported lazily: this module also loads in production, where pytest isn't installed.
    from _pytest.runner import pytest_runtest_call
    from django.test import testcases

    setup_teardown = frozenset(
        getattr(method, "__func__", method).__code__
        for cls in (testcases.SimpleTestCase, testcases.TransactionTestCase)
        for name in ("_pre_setup", "_post_teardown")
        if (method := vars(cls).get(name)) is not None
    )
    return pytest_runtest_call.__code__, setup_teardown


def validate_transaction_using_for_silo_mode(using: str | None) -> None:
    from sentry.hybridcloud.models.outbox import CellOutbox, ControlOutbox
    from sentry.silo.base import SiloMode

    if using is None:
        raise TransactionMissingDBException("'using' must be specified when creating a transaction")

    current_silo_mode = SiloMode.get_current_mode()
    if current_silo_mode == SiloMode.MONOLITH:
        return

    control_db = _get_db_for_model_if_available(ControlOutbox)
    cell_db = _get_db_for_model_if_available(CellOutbox)
    if control_db == cell_db:
        return

    if using == control_db and current_silo_mode != SiloMode.CONTROL:
        error = f"Cannot use transaction.atomic({using}) except in Control Mode"
    elif using == cell_db and current_silo_mode != SiloMode.CELL:
        error = f"Cannot use transaction.atomic({using}) except in Cell Mode"
    else:
        return

    # During setup and teardown of a test environment, allow treating it as one
    # DB. But make sure we enforce as normal during the actual test case. Checked
    # last because walking the stack is expensive.
    if in_test_environment() and not is_in_test_case_body():
        return

    raise MismatchedSiloTransactionError(error)


def patch_silo_aware_atomic() -> None:
    global _default_on_commit, _default_get_connection, _default_atomic_impl

    _default_atomic_impl = transaction.atomic
    _default_on_commit = transaction.on_commit
    _default_get_connection = transaction.get_connection

    transaction.atomic = siloed_atomic  # type: ignore[assignment]
    transaction.on_commit = siloed_on_commit  # type: ignore[assignment]
    transaction.get_connection = siloed_get_connection
