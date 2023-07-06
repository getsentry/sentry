from __future__ import annotations

import contextlib
import functools
import threading
from types import TracebackType
from typing import Any, Callable, Generator, List, Mapping, Optional, Sequence, Tuple, Type

from django.db import transaction
from django.db.backends.base.base import BaseDatabaseWrapper

from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud import DelegatedBySiloMode, hc_test_stub
from sentry.silo import SiloMode
from sentry.testutils.silo import assume_test_silo_mode


class use_real_service:
    service: object
    silo_mode: SiloMode | None
    context: contextlib.ExitStack

    def __init__(self, service: object, silo_mode: SiloMode | None):
        self.silo_mode = silo_mode
        self.service = service
        self.context = contextlib.ExitStack()

    def __enter__(self) -> None:
        from django.test import override_settings

        if isinstance(self.service, DelegatedBySiloMode):
            if self.silo_mode is not None:
                self.context.enter_context(override_settings(SILO_MODE=self.silo_mode))
                self.context.enter_context(self.service.with_replacement(None, self.silo_mode))
            else:
                self.context.enter_context(
                    self.service.with_replacement(None, SiloMode.get_current_mode())
                )
        else:
            raise ValueError("Service needs to be a DelegatedBySiloMode object, but it was not!")

    def __call__(self, f: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(f)
        def wrapped(*args: Any, **kwds: Any) -> Any:
            with use_real_service(self.service, self.silo_mode):
                return f(*args, **kwds)

        return wrapped

    def __exit__(
        self,
        __exc_type: Type[BaseException] | None,
        __exc_value: BaseException | None,
        __traceback: TracebackType | None,
    ) -> bool | None:
        return self.context.__exit__(__exc_type, __exc_value, __traceback)


@contextlib.contextmanager
def service_stubbed(
    service: object,
    stub: Optional[object],
    silo_mode: Optional[SiloMode] = None,
) -> Generator[None, None, None]:
    """
    Replaces a service created with silo_mode_delegation with a replacement implementation while inside of the scope,
    closing the existing implementation on enter and closing the given implementation on exit.
    """
    if silo_mode is None:
        silo_mode = SiloMode.get_current_mode()

    if isinstance(service, DelegatedBySiloMode):
        with service.with_replacement(stub, silo_mode):
            yield
    else:
        raise ValueError("Service needs to be a DelegatedBySilMode object, but it was not!")


@contextlib.contextmanager
def enforce_inter_silo_max_calls(max_calls: int) -> Generator[None, None, None]:
    call_sites: List[Tuple[Any, str, Sequence[Any], Mapping[str, Any]]] = []

    def cb(service: Any, method_name: str, *args: Sequence[Any], **kwds: Mapping[str, Any]):
        call_sites.append((service, method_name, args, kwds))
        assert (
            len(call_sites) < max_calls
        ), "Too many inter silo calls (through stubs) found!  Consider consolidating total calls."

    hc_test_stub.cb = cb
    try:
        yield
    finally:
        hc_test_stub.cb = None


class HybridCloudTestMixin:
    @assume_test_silo_mode(SiloMode.CONTROL)
    def assert_org_member_mapping(self, org_member: OrganizationMember, expected=None):
        org_member.refresh_from_db()
        org_member_mapping_query = OrganizationMemberMapping.objects.filter(
            organization_id=org_member.organization_id,
            organizationmember_id=org_member.id,
        )

        assert org_member_mapping_query.count() == 1
        org_member_mapping = org_member_mapping_query.get()

        email = org_member_mapping.email
        user_id = org_member_mapping.user_id
        # only either user_id or email should have a value, but not both.
        assert (email is None and user_id) or (email and user_id is None)

        assert org_member_mapping.role == org_member.role
        if org_member.inviter_id:
            assert org_member_mapping.inviter_id == org_member.inviter_id
        else:
            assert org_member_mapping.inviter_id is None
        assert org_member_mapping.invite_status == org_member.invite_status
        if expected:
            for key, expected_value in expected.items():
                assert getattr(org_member_mapping, key) == expected_value

    @assume_test_silo_mode(SiloMode.CONTROL)
    def assert_org_member_mapping_not_exists(self, org_member: OrganizationMember):
        email = org_member.email
        user_id = org_member.user_id
        # only either user_id or email should have a value, but not both.
        assert (email is None and user_id) or (email and user_id is None)

        assert not OrganizationMemberMapping.objects.filter(
            organization_id=org_member.organization_id,
            organizationmember_id=org_member.id,
        ).exists()


class SimulatedTransactionWatermarks(threading.local):
    state: dict[str, int] = {}

    @staticmethod
    def get_transaction_depth(connection: BaseDatabaseWrapper) -> int:
        total = len(connection.savepoint_ids)
        if connection.in_atomic_block:
            total += 1
        return total

    def connection_above_watermark(
        self, using: str | None = None, connection: BaseDatabaseWrapper | None = None
    ) -> bool:
        if connection is None:
            connection = transaction.get_connection(using)
        return self.get_transaction_depth(connection) > self.state.get(using, 0)


simulated_transaction_watermarks = SimulatedTransactionWatermarks()


@contextlib.contextmanager
def simulate_on_commit(request: Any):
    """
    Deal with the fact that django TestCase class is both used heavily, and also, complicates our ability to
    correctly test on_commit hooks.  Allows the use of django_test_transaction_water_mark to create a 'simulated'
    level of outer transaction that fires on_commit hooks, allowing for logic dependent on this behavior (usually
    outbox processing) to correctly detect which savepoint should call the `on_commit` hook.
    """

    from django.conf import settings

    simulated_transaction_watermarks.state = {}

    _old_atomic_exit = transaction.Atomic.__exit__
    _old_transaction_on_commit = transaction.on_commit

    def maybe_flush_commit_hooks(connection: BaseDatabaseWrapper):
        if connection.closed_in_transaction or connection.needs_rollback:
            return

        if simulated_transaction_watermarks.connection_above_watermark(connection=connection):
            return

        old_validate = connection.validate_no_atomic_block
        connection.validate_no_atomic_block = lambda: None
        try:
            connection.run_and_clear_commit_hooks()
        finally:
            connection.validate_no_atomic_block = old_validate

    def new_atomic_exit(self, exc_type, *args, **kwds):
        _old_atomic_exit(self, exc_type, *args, **kwds)
        if exc_type is not None:
            return
        connection = transaction.get_connection(self.using)
        maybe_flush_commit_hooks(connection)

    def new_atomic_on_commit(func, using=None):
        _old_transaction_on_commit(func, using)
        maybe_flush_commit_hooks(transaction.get_connection(using))

    for db_name in settings.DATABASES:
        simulated_transaction_watermarks.state[
            db_name
        ] = simulated_transaction_watermarks.get_transaction_depth(
            transaction.get_connection(db_name)
        )

    functools.update_wrapper(new_atomic_exit, _old_atomic_exit)
    functools.update_wrapper(new_atomic_on_commit, _old_transaction_on_commit)
    transaction.Atomic.__exit__ = new_atomic_exit  # type: ignore
    transaction.on_commit = new_atomic_on_commit
    setattr(BaseDatabaseWrapper, "maybe_flush_commit_hooks", maybe_flush_commit_hooks)
    try:
        yield
    finally:
        transaction.Atomic.__exit__ = _old_atomic_exit  # type: ignore
        transaction.on_commit = _old_transaction_on_commit
        delattr(BaseDatabaseWrapper, "maybe_flush_commit_hooks")
