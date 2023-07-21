from __future__ import annotations

import contextlib
import functools
import threading
from types import TracebackType
from typing import (
    Any,
    Callable,
    Generator,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
    Set,
    Tuple,
    Type,
    TypedDict,
)

from django.db import connections, transaction
from django.db.backends.base.base import BaseDatabaseWrapper

from sentry.db.postgres.transactions import in_test_transaction_enforcement
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

    def connection_transaction_depth_above_watermark(
        self, using: str | None = None, connection: BaseDatabaseWrapper | None = None
    ) -> int:
        if connection is None:
            connection = transaction.get_connection(using or "default")
        return max(self.get_transaction_depth(connection) - self.state.get(connection.alias, 0), 0)

    def connections_above_watermark(self) -> Set[str]:
        result = set()
        for connection in connections.all():
            if self.connection_transaction_depth_above_watermark(connection=connection):
                result.add(connection.alias)
        return result


simulated_transaction_watermarks = SimulatedTransactionWatermarks()


class EnforceNoCrossTransactionWrapper:
    alias: str

    def __init__(self, alias: str):
        self.alias = alias

    def __call__(self, execute: Callable[..., Any], *params: Any) -> Any:
        if not in_test_transaction_enforcement.enabled:
            return execute(*params)

        open_transactions = simulated_transaction_watermarks.connections_above_watermark()
        # If you are hitting this, it means you have two open transactions working in differing databases at the same
        # time.  This is problematic in general for a variety of reasons -- it will never be possible to atomically
        # transact in both databases (one may succeed and the other fail), but more likely, it means a bug in attempting
        # to transact with resources that may not even co-exist in production (split silo db is a good example).
        # Ideally, restructure transactions that span different databases into separate discrete blocks.
        # It is fine to nest transactions so long as they are operating on the same database.
        # Alternatively, it may be possible you are hitting this due to limitations in the test environment, such as
        # when celery tasks fire synchronously, or other work is done in a test that would normally be separated by
        # different connections / processes.  If you believe this is the case, context the #project-hybrid-cloud channel
        # for assistance.
        assert (
            len(open_transactions) < 2
        ), f"Found mixed open transactions between dbs {open_transactions}"
        if open_transactions:
            assert (
                self.alias in open_transactions
            ), f"Transaction opened for db {open_transactions}, but command running against db {self.alias}"

        return execute(*params)


@contextlib.contextmanager
def enforce_no_cross_transaction_interactions():
    with contextlib.ExitStack() as stack:
        for conn in connections.all():
            stack.enter_context(conn.execute_wrapper(EnforceNoCrossTransactionWrapper(conn.alias)))
        yield


class TransactionDetails(TypedDict):
    transaction: str | None
    queries: List[str]


class TransactionDetailsWrapper:
    result: List[TransactionDetails]
    alias: str

    def __init__(self, alias: str, result: List[TransactionDetails]):
        self.result = result
        self.alias = alias

    def __call__(self, execute: Callable[..., Any], query: str, *args: Any) -> Any:
        release = query.startswith("RELEASE")
        savepoint = query.startswith("SAVEPOINT")
        depth = simulated_transaction_watermarks.connection_transaction_depth_above_watermark(
            using=self.alias
        )
        active_transaction = self.alias if release or savepoint or depth else None
        if (
            (savepoint and depth == 0)
            or not self.result
            or self.result[-1]["transaction"] != active_transaction
        ):
            cur: TransactionDetails = {"transaction": active_transaction, "queries": []}
            self.result.append(cur)
        else:
            cur = self.result[-1]
        cur["queries"].append(query)
        return execute(query, *args)


@contextlib.contextmanager
def collect_transaction_queries() -> Iterator[List[TransactionDetails]]:
    result: List[TransactionDetails] = []

    with contextlib.ExitStack() as stack:
        for conn in connections.all():
            stack.enter_context(conn.execute_wrapper(TransactionDetailsWrapper(conn.alias, result)))
        yield result


@contextlib.contextmanager
def simulate_on_commit(request: Any):
    """
    Deal with the fact that django TestCase class is both used heavily, and also, complicates our ability to
    correctly test on_commit hooks.  Allows the use of django_test_transaction_water_mark to create a 'simulated'
    level of outer transaction that fires on_commit hooks, allowing for logic dependent on this behavior (usually
    outbox processing) to correctly detect which savepoint should call the `on_commit` hook.
    """

    from django.db import transaction
    from django.test import TestCase as DjangoTestCase

    request_node_cls = request.node.cls
    is_django_test_case = request_node_cls is not None and issubclass(
        request_node_cls, DjangoTestCase
    )
    simulated_transaction_watermarks.state = {}

    _old_atomic_exit = transaction.Atomic.__exit__
    _old_transaction_on_commit = transaction.on_commit

    def maybe_flush_commit_hooks(connection: BaseDatabaseWrapper):
        if connection.closed_in_transaction or connection.needs_rollback:
            return

        if simulated_transaction_watermarks.connection_transaction_depth_above_watermark(
            connection=connection
        ):
            return

        old_validate = connection.validate_no_atomic_block
        connection.validate_no_atomic_block = lambda: None  # type: ignore
        try:
            connection.run_and_clear_commit_hooks()
        finally:
            connection.validate_no_atomic_block = old_validate  # type: ignore

    def new_atomic_exit(self, exc_type, *args, **kwds):
        _old_atomic_exit(self, exc_type, *args, **kwds)
        if exc_type is not None:
            return
        connection = transaction.get_connection(self.using)
        maybe_flush_commit_hooks(connection)

    def new_atomic_on_commit(func, using=None):
        _old_transaction_on_commit(func, using)
        maybe_flush_commit_hooks(transaction.get_connection(using))

    for conn in connections.all():
        # This value happens to match the number of outer transactions in
        # a django test case.  Unfortunately, the timing of when setup is called
        # vs when that final outer transaction is added makes it impossible to
        # sample the value directly -- we just have to specify it here.
        # That said, there are tests that would fail if this number were wrong.
        if is_django_test_case:
            simulated_transaction_watermarks.state[conn.alias] = 2
        else:
            simulated_transaction_watermarks.state[
                conn.alias
            ] = simulated_transaction_watermarks.get_transaction_depth(conn)

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
