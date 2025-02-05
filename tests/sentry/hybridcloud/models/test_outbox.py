import functools
import threading
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any
from unittest.mock import Mock, patch

import pytest
from django.db import OperationalError, connections, router, transaction
from django.test import RequestFactory
from django.utils import timezone as django_timezone
from pytest import raises

from sentry.hybridcloud.models.outbox import (
    ControlOutbox,
    OutboxFlushError,
    RegionOutbox,
    outbox_context,
)
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.hybridcloud.tasks.deliver_from_outbox import enqueue_outbox_jobs
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.organizationmemberteamreplica import OrganizationMemberTeamReplica
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test
from sentry.types.region import Region, RegionCategory, get_local_region
from sentry.users.models.user import User


def wrap_with_connection_closure(c: Callable[..., Any]) -> Callable[..., Any]:
    def wrapper(*args: Any, **kwds: Any) -> Any:
        try:
            return c(*args, **kwds)
        finally:
            for connection in connections.all():
                connection.close()

    functools.update_wrapper(wrapper, c)
    return wrapper


@pytest.fixture(autouse=True, scope="function")
def setup_clear_fixture_outbox_messages() -> None:
    with outbox_runner():
        pass


@control_silo_test
class ControlOutboxTest(TestCase):
    webhook_request = RequestFactory().post(
        "/extensions/github/webhook/?query=test",
        data={"installation": {"id": "github:1"}},
        content_type="application/json",
        HTTP_X_GITHUB_EMOTICON=">:^]",
    )
    region = Region("eu", 1, "http://eu.testserver", RegionCategory.MULTI_TENANT)
    region_config = (region,)

    def test_skip_shards(self) -> None:
        with self.options({"hybrid_cloud.authentication.disabled_user_shards": [100]}):
            assert ControlOutbox(
                shard_scope=OutboxScope.USER_SCOPE, shard_identifier=100
            ).should_skip_shard()
            assert not ControlOutbox(
                shard_scope=OutboxScope.USER_SCOPE, shard_identifier=101
            ).should_skip_shard()

        assert not ControlOutbox(
            shard_scope=OutboxScope.USER_SCOPE, shard_identifier=100
        ).should_skip_shard()

    def test_control_sharding_keys(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            org = Factories.create_organization()

        user1 = Factories.create_user()
        user2 = Factories.create_user()

        with assume_test_silo_mode(SiloMode.REGION):
            expected_region_name = get_local_region().name
            om = OrganizationMember.objects.create(
                organization_id=org.id,
                user_id=user1.id,
                role=org.default_role,
            )
            om.outbox_for_update().drain_shard()

            om = OrganizationMember.objects.create(
                organization_id=org.id,
                user_id=user2.id,
                role=org.default_role,
            )
            om.outbox_for_update().drain_shard()

        with outbox_context(flush=False):
            for inst in User.outboxes_for_user_update(user1.id):
                inst.save()
            for inst in User.outboxes_for_user_update(user2.id):
                inst.save()

        shards = {
            (row["shard_scope"], row["shard_identifier"], row["region_name"])
            for row in ControlOutbox.find_scheduled_shards()
        }

        assert shards == {
            (OutboxScope.USER_SCOPE.value, user1.id, expected_region_name),
            (OutboxScope.USER_SCOPE.value, user2.id, expected_region_name),
        }

    def test_prepare_next_from_shard_no_conflict_with_processing(self) -> None:
        with outbox_runner():
            org = Factories.create_organization()
            user1 = Factories.create_user()
            Factories.create_member(organization_id=org.id, user_id=user1.id)

        with outbox_context(flush=False):
            outbox = user1.outboxes_for_update()[0]
            outbox.save()
            with outbox.process_shard(None) as next_shard_row:
                assert next_shard_row is not None

                def test_with_other_connection() -> None:
                    try:
                        assert (
                            ControlOutbox.prepare_next_from_shard(
                                {
                                    k: getattr(next_shard_row, k)
                                    for k in ControlOutbox.sharding_columns
                                }
                            )
                            is None
                        )
                    finally:
                        for c in connections.all():
                            c.close()

                t = threading.Thread(target=test_with_other_connection)
                t.start()
                t.join()


class OutboxDrainTest(TransactionTestCase):
    @patch("sentry.hybridcloud.models.outbox.process_region_outbox.send")
    def test_draining_with_disabled_shards(self, mock_send: Mock) -> None:
        outbox1 = Organization(id=1).outbox_for_update()
        outbox2 = Organization(id=1).outbox_for_update()
        outbox3 = Organization(id=2).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()
            outbox2.save()
            outbox3.save()

        with self.options({"hybrid_cloud.authentication.disabled_organization_shards": [1]}):
            outbox1.drain_shard()
            with pytest.raises(RegionOutbox.DoesNotExist):
                outbox1.refresh_from_db()
            outbox2.refresh_from_db()  # still exists

            assert mock_send.call_count == 0

            outbox3.drain_shard()
            with pytest.raises(RegionOutbox.DoesNotExist):
                outbox3.refresh_from_db()

            assert mock_send.call_count == 1

    def test_drain_shard_not_flush_all__upper_bound(self) -> None:
        outbox1 = Organization(id=1).outbox_for_update()
        outbox2 = Organization(id=2).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()
            outbox2.save()
            # Ensure outbox2 is saved with a later scheduled_for time
            outbox2.scheduled_for = django_timezone.now() + timedelta(hours=1)
            outbox2.save()

        # Verify initial state
        assert RegionOutbox.objects.count() == 2

        # Create barriers for synchronizing threads
        start_barrier = threading.Barrier(2, timeout=5)
        end_barrier = threading.Barrier(2, timeout=5)

        def process_with_barriers() -> None:
            try:
                using = router.db_for_write(RegionOutbox)
                with connections[using].cursor() as cursor:
                    cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    cursor.close()

                with transaction.atomic(using=using):
                    messages = RegionOutbox.objects.filter(
                        scheduled_for__lte=django_timezone.now()
                    ).select_for_update(nowait=True)

                    if messages.exists():
                        # Signal the main thread that we're about to process
                        start_barrier.wait()
                        # Get message IDs within transaction
                        message_ids = list(messages.values_list("id", flat=True))

                # Process outside of transaction
                for message_id in message_ids:
                    message = RegionOutbox.objects.get(id=message_id)
                    message.send_signal()

                # Delete inside transaction
                with transaction.atomic(using=using):
                    RegionOutbox.objects.filter(id__in=message_ids).delete()

            except Exception:
                start_barrier.abort()
                raise
            finally:
                try:
                    end_barrier.wait()
                except threading.BrokenBarrierError:
                    pass

        processing_thread = threading.Thread(
            target=wrap_with_connection_closure(process_with_barriers)
        )
        processing_thread.start()

        try:
            # Wait for processing to start
            start_barrier.wait()

            # Save outbox2 after processing has started
            with outbox_context(flush=False):
                outbox2.save()
                # Ensure outbox2 is saved with a later scheduled_for time
                outbox2.scheduled_for = django_timezone.now() + timedelta(hours=1)
                outbox2.save()

            # Let processing continue and complete
            end_barrier.wait()

            # Wait for thread to complete
            processing_thread.join(timeout=5)

            # Verify that outbox1 was processed but outbox2 was not
            assert not RegionOutbox.objects.filter(id=outbox1.id).exists()
            assert RegionOutbox.objects.filter(id=outbox2.id).exists()
        except Exception:
            # Ensure thread is cleaned up if test fails
            start_barrier.abort()
            processing_thread.join(timeout=1)
            raise

    @patch("sentry.hybridcloud.models.outbox.process_region_outbox.send")
    def test_drain_shard_not_flush_all__concurrent_processing(
        self, mock_process_region_outbox: Mock
    ) -> None:
        outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
        outbox2 = OrganizationMember(id=2, organization_id=3, user_id=2).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()
            outbox2.save()

        barrier: threading.Barrier = threading.Barrier(2, timeout=1)
        processing_thread_1 = threading.Thread(
            target=wrap_with_connection_closure(
                lambda: outbox1.drain_shard(_test_processing_barrier=barrier)
            )
        )
        processing_thread_1.start()

        # This concurrent process will block on, and not duplicate, the effort of the first thread.
        processing_thread_2 = threading.Thread(
            target=wrap_with_connection_closure(
                lambda: outbox2.drain_shard(_test_processing_barrier=barrier)
            )
        )

        barrier.wait()
        processing_thread_2.start()
        barrier.wait()
        barrier.wait()
        barrier.wait()

        processing_thread_1.join()
        processing_thread_2.join()

        assert not RegionOutbox.objects.filter(id=outbox1.id).first()
        assert not RegionOutbox.objects.filter(id=outbox2.id).first()

        assert mock_process_region_outbox.call_count == 2

    def test_drain_shard_flush_all__upper_bound(self) -> None:
        outbox1 = Organization(id=1).outbox_for_update()
        outbox2 = Organization(id=1).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()

        barrier: threading.Barrier = threading.Barrier(2, timeout=5)
        processing_thread = threading.Thread(
            target=wrap_with_connection_closure(
                lambda: outbox1.drain_shard(flush_all=True, _test_processing_barrier=barrier)
            )
        )
        processing_thread.start()

        # Wait for initial processing
        barrier.wait()

        # Does include outboxes created after starting process.
        with outbox_context(flush=False):
            outbox2.save()

        # Let processing continue
        barrier.wait()

        # Wait for thread to complete
        processing_thread.join(timeout=5)
        assert not RegionOutbox.objects.filter(id=outbox1.id).exists()
        assert not RegionOutbox.objects.filter(id=outbox2.id).exists()

    @patch("sentry.hybridcloud.models.outbox.process_region_outbox.send")
    def test_drain_shard_flush_all__concurrent_processing__cooperation(
        self, mock_process_region_outbox: Mock
    ) -> None:
        outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
        outbox2 = OrganizationMember(id=2, organization_id=3, user_id=2).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()
            outbox2.save()

        barrier: threading.Barrier = threading.Barrier(2, timeout=1)
        processing_thread_1 = threading.Thread(
            target=wrap_with_connection_closure(
                lambda: outbox1.drain_shard(_test_processing_barrier=barrier)
            )
        )
        processing_thread_1.start()

        # This concurrent process will block on, and not duplicate, the effort of the first thread.
        processing_thread_2 = threading.Thread(
            target=wrap_with_connection_closure(
                lambda: outbox2.drain_shard(flush_all=True, _test_processing_barrier=barrier)
            )
        )

        barrier.wait()
        processing_thread_2.start()
        barrier.wait()
        barrier.wait()
        barrier.wait()

        processing_thread_1.join()
        processing_thread_2.join()

        assert not RegionOutbox.objects.filter(id=outbox1.id).first()
        assert not RegionOutbox.objects.filter(id=outbox2.id).first()

        assert mock_process_region_outbox.call_count == 2


def with_serializable_isolation(func: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        using = router.db_for_write(RegionOutbox)
        with connections[using].cursor() as cursor:
            cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
            cursor.close()
        try:
            return func(*args, **kwargs)
        finally:
            for conn in connections.all():
                conn.close()

    return wrapper


class RegionOutboxTest(TransactionTestCase):
    def test_creating_org_outboxes(self) -> None:
        with outbox_context(flush=False):
            Organization(id=10).outbox_for_update().save()
            OrganizationMember(organization_id=12, id=15).outbox_for_update().save()
        assert RegionOutbox.objects.count() == 2

        with outbox_runner():
            # drain outboxes
            pass
        assert RegionOutbox.objects.count() == 0

    def test_skip_shards(self) -> None:
        with self.options({"hybrid_cloud.authentication.disabled_organization_shards": [100]}):
            assert Organization(id=100).outbox_for_update().should_skip_shard()
            assert not Organization(id=101).outbox_for_update().should_skip_shard()

        assert not Organization(id=100).outbox_for_update().should_skip_shard()

    def test_concurrent_coalesced_object_processing(self) -> None:
        """
        Test that when two threads concurrently call process_coalesced() for the same coalesced group,
        exactly one thread obtains the lock and reservation (i.e. yields a non-None result)
        while the other immediately yields None.
        """
        # Create three outbox messages with the same coalescing keys.
        # They will be coalesced into a single group.
        outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
        outbox2 = OrganizationMember(id=2, organization_id=3, user_id=1).outbox_for_update()
        outbox3 = OrganizationMember(id=3, organization_id=3, user_id=1).outbox_for_update()
        for outbox in (outbox1, outbox2, outbox3):
            # Set coalescing key fields:
            outbox.shard_scope = OutboxScope.ORGANIZATION_SCOPE
            outbox.shard_identifier = 100
            outbox.category = OutboxCategory.ORGANIZATION_MEMBER_UPDATE
            outbox.object_identifier = 1
            # Ensure each message is eligible for processing by setting scheduled_for in the past.
            outbox.scheduled_for = django_timezone.now() - timedelta(minutes=1)

        with outbox_context(flush=False):
            outbox1.save()
            outbox2.save()
            outbox3.save()

        # Use a Barrier to synchronize the two threads.
        barrier = threading.Barrier(2)
        results = []

        def worker() -> None:
            # Wait until both threads are ready so that they call process_coalesced concurrently.
            barrier.wait()
            with outbox1.process_coalesced(is_synchronous_flush=True) as result:
                results.append(result)

        t1 = threading.Thread(target=worker)
        t2 = threading.Thread(target=worker)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Exactly one thread should receive a non-None result, which indicates that it got the lock and reserved the group.
        non_none_results = [r for r in results if r is not None]
        assert (
            len(non_none_results) == 1
        ), f"Expected exactly one thread to get a reservation, but got {results}"

    def test_process_coalesced_partial_failure(self) -> None:
        """Test that partial failures during batch processing are handled correctly"""
        outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
        outbox2 = OrganizationMember(id=2, organization_id=3, user_id=1).outbox_for_update()
        outbox3 = OrganizationMember(id=3, organization_id=3, user_id=1).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()
            outbox2.save()
            outbox3.save()

        # Verify initial state
        assert RegionOutbox.objects.count() == 3

        # Mock select_for_update to simulate a failure after deleting some messages
        original_select_for_update = RegionOutbox.objects.select_for_update
        delete_called = 0

        def mock_select_for_update(*args: Any, **kwargs: Any) -> Any:
            nonlocal delete_called
            delete_called += 1
            if delete_called > 1:  # Fail after first successful batch
                raise OperationalError("could not obtain lock")
            return original_select_for_update(*args, **kwargs)

        with patch.object(
            RegionOutbox.objects, "select_for_update", side_effect=mock_select_for_update
        ):

            def process_with_error() -> None:
                using = router.db_for_write(RegionOutbox)
                with connections[using].cursor() as cursor:
                    cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                    cursor.close()

                # First, get the coalesced messages
                coalesced_id = None
                with transaction.atomic(using=using):
                    coalesced = (
                        outbox1.select_coalesced_messages().select_for_update(nowait=True).first()
                    )
                    if coalesced:
                        coalesced_id = coalesced.id

                if coalesced_id:
                    # Process outside of transaction
                    coalesced = RegionOutbox.objects.get(id=coalesced_id)
                    coalesced.send_signal()
                    # Delete inside transaction
                    with transaction.atomic(using=using):
                        RegionOutbox.objects.filter(id=coalesced_id).delete()

            process_with_error()

        # Verify that some messages were processed but not all
        assert RegionOutbox.objects.count() == 2

    def test_process_coalesced_large_batch(self) -> None:
        """Test processing a large number of coalesced messages"""
        num_messages = 200  # More than batch size of 50
        outboxes = []

        for i in range(num_messages):
            outbox = OrganizationMember(id=i + 1, organization_id=3, user_id=1).outbox_for_update()
            outboxes.append(outbox)

        with outbox_context(flush=False):
            for outbox in outboxes:
                outbox.save()

        # Verify initial state
        assert RegionOutbox.objects.count() == num_messages

        # Process all messages
        def process_large_batch() -> None:
            using = router.db_for_write(RegionOutbox)
            with connections[using].cursor() as cursor:
                cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                cursor.close()

            while RegionOutbox.objects.exists():
                # First, get all coalesced messages
                coalesced_ids = []
                with transaction.atomic(using=using):
                    coalesced = (
                        RegionOutbox.objects.filter(category=outboxes[0].category)
                        .select_for_update(nowait=True)
                        .values_list("id", flat=True)
                    )
                    coalesced_ids = list(coalesced)

                if not coalesced_ids:
                    break

                # Process outside of transaction
                for coalesced_id in coalesced_ids:
                    coalesced_obj = RegionOutbox.objects.get(id=coalesced_id)
                    coalesced_obj.send_signal()

                # Delete inside transaction
                with transaction.atomic(using=using):
                    RegionOutbox.objects.filter(id__in=coalesced_ids).delete()

        process_large_batch()

        # Verify all messages were processed
        assert RegionOutbox.objects.count() == 0

    def test_outbox_rescheduling(self) -> None:
        with patch(
            "sentry.hybridcloud.models.outbox.process_region_outbox.send"
        ) as mock_process_region_outbox:

            def raise_exception(**kwargs: Any) -> None:
                raise ValueError("This is just a test mock exception")

            def run_with_error(concurrency: int = 1) -> None:
                mock_process_region_outbox.side_effect = raise_exception
                mock_process_region_outbox.reset_mock()
                with self.tasks():
                    with raises(OutboxFlushError):
                        enqueue_outbox_jobs(concurrency=concurrency, process_outbox_backfills=False)
                    assert mock_process_region_outbox.call_count == 1

            def ensure_converged() -> None:
                mock_process_region_outbox.reset_mock()
                with self.tasks():
                    enqueue_outbox_jobs(process_outbox_backfills=False)
                    assert mock_process_region_outbox.call_count == 0

            def assert_called_for_org(org: int) -> None:
                mock_process_region_outbox.assert_called_with(
                    sender=OutboxCategory.ORGANIZATION_UPDATE,
                    payload=None,
                    object_identifier=org,
                    shard_identifier=org,
                    shard_scope=OutboxScope.ORGANIZATION_SCOPE,
                )

            with outbox_context(flush=False):
                Organization(id=10001).outbox_for_update().save()
                Organization(id=10002).outbox_for_update().save()

            start_time = datetime(2022, 10, 1, 0)
            with freeze_time(start_time):
                run_with_error()
                assert_called_for_org(10001)

            # Runs things in ascending order of the scheduled_for
            with freeze_time(start_time + timedelta(minutes=10)):
                run_with_error()
                assert_called_for_org(10002)

            # Has rescheduled all objects into the future.
            with freeze_time(start_time):
                ensure_converged()

            # Next would run the original rescheduled org1 entry
            with freeze_time(start_time + timedelta(minutes=10)):
                run_with_error()
                assert_called_for_org(10001)
                ensure_converged()

                # Concurrently added items will favor a newer scheduling time,
                # but eventually converges.
                with outbox_context(flush=False):
                    Organization(id=10002).outbox_for_update().save()
                run_with_error()
                ensure_converged()

    def test_outbox_converges(self) -> None:
        with (
            patch(
                "sentry.hybridcloud.models.outbox.process_region_outbox.send"
            ) as mock_process_region_outbox,
            outbox_context(flush=False),
        ):
            Organization(id=10001).outbox_for_update().save()
            Organization(id=10001).outbox_for_update().save()

            Organization(id=10002).outbox_for_update().save()
            Organization(id=10002).outbox_for_update().save()

            last_call_count = 0
            while True:
                with self.tasks():
                    enqueue_outbox_jobs(process_outbox_backfills=False)
                    if last_call_count == mock_process_region_outbox.call_count:
                        break
                    last_call_count = mock_process_region_outbox.call_count

            assert last_call_count == 2

    def test_region_sharding_keys(self) -> None:
        org1 = Factories.create_organization()
        org2 = Factories.create_organization()

        with outbox_context(flush=False):
            Organization(id=org1.id).outbox_for_update().save()
            Organization(id=org2.id).outbox_for_update().save()

            OrganizationMember(organization_id=org1.id, id=1).outbox_for_update().save()
            OrganizationMember(organization_id=org2.id, id=2).outbox_for_update().save()

        shards = {
            (row["shard_scope"], row["shard_identifier"])
            for row in RegionOutbox.find_scheduled_shards()
        }
        assert shards == {
            (OutboxScope.ORGANIZATION_SCOPE.value, org1.id),
            (OutboxScope.ORGANIZATION_SCOPE.value, org2.id),
        }

    def test_scheduling_with_future_outbox_time(self) -> None:
        with outbox_runner():
            pass

        start_time = datetime(year=2022, month=10, day=1, second=0, tzinfo=timezone.utc)
        with freeze_time(start_time):
            future_scheduled_outbox = Organization(id=10001).outbox_for_update()
            future_scheduled_outbox.scheduled_for = start_time + timedelta(hours=1)
            future_scheduled_outbox.save()
            assert future_scheduled_outbox.scheduled_for > start_time
            assert RegionOutbox.objects.count() == 1

            assert len(RegionOutbox.find_scheduled_shards()) == 0

            with outbox_runner():
                pass

            # Since the event is sometime in the future, we expect the single
            #  outbox message not to be processed
            assert RegionOutbox.objects.count() == 1

    def test_scheduling_with_past_and_future_outbox_times(self) -> None:
        with outbox_runner():
            pass

        start_time = datetime(year=2022, month=10, day=1, second=0, tzinfo=timezone.utc)
        with freeze_time(start_time):
            future_scheduled_outbox = Organization(id=10001).outbox_for_update()
            future_scheduled_outbox.scheduled_for = start_time + timedelta(hours=1)
            future_scheduled_outbox.save()
            assert future_scheduled_outbox.scheduled_for > start_time

            past_scheduled_outbox = Organization(id=10001).outbox_for_update()
            past_scheduled_outbox.save()
            assert past_scheduled_outbox.scheduled_for < start_time
            assert RegionOutbox.objects.count() == 2

            assert len(RegionOutbox.find_scheduled_shards()) == 1

            with outbox_runner():
                pass

            # We expect the shard to be drained if at *least* one scheduled
            # message is in the past.
            assert RegionOutbox.objects.count() == 0

    def test_process_coalesced_explicit_ordering(self) -> None:
        """Test that coalesced messages are processed in the correct order"""
        outboxes = []
        for i in range(5):
            outbox = OrganizationMember(id=i + 1, organization_id=3, user_id=1).outbox_for_update()
            outboxes.append(outbox)

        with outbox_context(flush=False):
            for outbox in reversed(outboxes):  # Save in reverse order
                outbox.save()

        processed_ids = []
        original_send_signal = RegionOutbox.send_signal

        def mock_send_signal(self: Any) -> None:
            processed_ids.append(self.id)
            original_send_signal(self)

        with patch.object(RegionOutbox, "send_signal", mock_send_signal):
            # Process all messages in the shard
            outboxes[0].drain_shard(flush_all=True)

        # Verify messages were processed in order by ID
        assert processed_ids == sorted(processed_ids)
        assert RegionOutbox.objects.count() == 0

    def test_process_coalesced_lock_acquisition(self) -> None:
        """Test lock acquisition behavior during coalesced processing"""
        outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
        outbox2 = OrganizationMember(
            id=2, organization_id=4, user_id=2
        ).outbox_for_update()  # Different organization and user
        outbox1.shard_identifier = 100
        outbox2.shard_identifier = 200  # Different shard_identifier

        with outbox_context(flush=False):
            outbox1.save()
            outbox2.save()

        # Create barriers to synchronize threads
        barrier = threading.Barrier(2, timeout=5)
        lock_acquired = threading.Event()
        process_completed = threading.Event()

        def process_thread_1() -> None:
            try:
                with outbox1.process_coalesced(is_synchronous_flush=True) as coalesced:
                    if coalesced:
                        lock_acquired.set()
                        barrier.wait()  # Signal thread 2 to try processing
                        process_completed.wait()  # Wait for thread 2 to attempt processing
                        coalesced.send_signal()
            finally:
                for conn in connections.all():
                    conn.close()

        def process_thread_2() -> None:
            try:
                barrier.wait()  # Wait for thread 1 to acquire lock
                assert lock_acquired.is_set()  # Ensure thread 1 has the lock
                with outbox2.process_coalesced(is_synchronous_flush=True) as coalesced:
                    if coalesced:
                        coalesced.send_signal()
                process_completed.set()
            finally:
                for conn in connections.all():
                    conn.close()

        t1 = threading.Thread(target=process_thread_1)
        t2 = threading.Thread(target=process_thread_2)

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Verify final state
        assert RegionOutbox.objects.count() == 0

    def test_process_coalesced_stable_snapshot(self) -> None:
        """Test that deletion uses a stable snapshot of coalesced messages"""
        outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
        # Explicitly set all coalescing key fields for outbox1
        outbox1.shard_scope = OutboxScope.ORGANIZATION_SCOPE
        outbox1.shard_identifier = 100
        outbox1.category = OutboxCategory.ORGANIZATION_MEMBER_UPDATE
        outbox1.object_identifier = 1
        outbox1.scheduled_for = django_timezone.now() - timedelta(minutes=1)  # Past

        with outbox_context(flush=False):
            outbox1.save()

        barrier = threading.Barrier(2, timeout=5)
        snapshot_taken = threading.Event()
        processing_started = threading.Event()

        def concurrent_insert() -> None:
            try:
                barrier.wait()  # Wait for main thread to start processing
                snapshot_taken.wait()  # Wait for snapshot to be taken
                # Add new message after snapshot with different organization and member IDs
                with outbox_context(flush=False):
                    outbox2 = OrganizationMember(
                        id=2, organization_id=4, user_id=2
                    ).outbox_for_update()
                    # Explicitly set all coalescing key fields for outbox2 to be different from outbox1
                    outbox2.shard_scope = OutboxScope.ORGANIZATION_SCOPE  # Same scope as outbox1
                    outbox2.shard_identifier = 200  # Different organization ID
                    outbox2.category = OutboxCategory.ORGANIZATION_MEMBER_UPDATE  # Same category
                    outbox2.object_identifier = 2  # Different member ID
                    outbox2.scheduled_for = django_timezone.now() + timedelta(hours=1)
                    outbox2.save()
                barrier.wait()  # Signal main thread to continue
            finally:
                for conn in connections.all():
                    conn.close()

        # Patch drain_shard to prevent background processing during test
        with patch("sentry.hybridcloud.models.outbox.OutboxBase.drain_shard"):
            t = threading.Thread(target=concurrent_insert)
            t.start()

            # Process outbox1 first
            using = router.db_for_write(RegionOutbox)
            with connections[using].cursor() as cursor:
                cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
                cursor.close()

            with outbox1.process_coalesced(is_synchronous_flush=True) as coalesced:
                if not processing_started.is_set():
                    processing_started.set()
                    snapshot_taken.set()  # Signal that we've taken the snapshot
                    barrier.wait()  # Wait for concurrent insert
                    barrier.wait()  # Wait for concurrent insert to complete
                if coalesced:
                    coalesced.send_signal()

            t.join()

            # Verify that outbox1 was deleted but outbox2 remains
            assert not RegionOutbox.objects.filter(
                id=outbox1.id
            ).exists()  # outbox1 should be deleted
            # Verify outbox2 by its unique coalescing keys instead of hardcoded ID
            assert RegionOutbox.objects.filter(
                shard_scope=OutboxScope.ORGANIZATION_SCOPE,
                shard_identifier=200,
                category=OutboxCategory.ORGANIZATION_MEMBER_UPDATE,
                object_identifier=2,
            ).exists()  # outbox2 should remain

    def test_process_coalesced_transaction_boundaries(self) -> None:
        """Test transaction boundaries during coalesced processing"""
        outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()

        transaction_state = []
        original_send_signal = RegionOutbox.send_signal

        def mock_send_signal(self: Any) -> None:
            # Check if we're in a transaction during signal sending
            using = router.db_for_write(type(self))
            transaction_state.append(transaction.get_connection(using=using).in_atomic_block)
            original_send_signal(self)

        with patch.object(RegionOutbox, "send_signal", mock_send_signal):
            with outbox1.process_coalesced(is_synchronous_flush=True) as coalesced:
                if coalesced:
                    coalesced.send_signal()

        # Verify signal was sent outside transaction
        assert not any(transaction_state), "Signal was sent within a transaction"
        assert RegionOutbox.objects.count() == 0

    def test_process_coalesced_scheduled_for(self) -> None:
        """
        Test that process_coalesced() updates scheduled_for for all messages in a group.
        """

        # Use a fixed point in time for determinism.
        fixed_time = datetime(2022, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        with freeze_time(fixed_time):
            # Create two outbox messages sharing the same coalescing keys.
            # (For example, using OrganizationMember.outbox_for_update() if that is how your app creates them.)
            outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
            outbox2 = OrganizationMember(id=2, organization_id=3, user_id=1).outbox_for_update()
            # Explicitly set all coalescing key fields so that they are grouped together.
            for outbox in (outbox1, outbox2):
                outbox.shard_scope = OutboxScope.ORGANIZATION_SCOPE
                outbox.shard_identifier = 100
                outbox.category = OutboxCategory.ORGANIZATION_MEMBER_UPDATE
                outbox.object_identifier = 1
                # Ensure at least one message is scheduled in the past so that they are eligible.
                outbox.scheduled_for = fixed_time - timedelta(minutes=1)

            with outbox_context(flush=False):
                outbox1.save()
                outbox2.save()

            # Call process_coalesced() to force the reservation step.
            with outbox1.process_coalesced(is_synchronous_flush=True):
                # At this point the reservation (UPDATE of scheduled_for) has been committed.
                # Retrieve the group of messages using their coalescing key fields.
                group = list(
                    RegionOutbox.objects.filter(
                        shard_scope=outbox1.shard_scope,
                        shard_identifier=outbox1.shard_identifier,
                        category=outbox1.category,
                        object_identifier=outbox1.object_identifier,
                    ).order_by("id")
                )

                # We expect both messages (or however many are in the group) to have their scheduled_for updated.
                # The new scheduled_for should be roughly fixed_time + 1 hour.
                expected = fixed_time + timedelta(hours=1)

                # Allow a small tolerance (a few seconds) in timing.
                tolerance = 5  # seconds
                for msg in group:
                    diff = abs((msg.scheduled_for - expected).total_seconds())
                    assert (
                        diff < tolerance
                    ), f"Message {msg.id} had scheduled_for {msg.scheduled_for}, expected ~{expected}"

    def test_process_coalesced_lock_error_handling(self) -> None:
        """Test error handling during lock acquisition"""
        outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()

        def mock_select_for_update(*args: Any, **kwargs: Any) -> Any:
            raise OperationalError("could not obtain lock")

        # Mock the select_for_update at the queryset level
        with patch(
            "django.db.models.query.QuerySet.select_for_update", side_effect=mock_select_for_update
        ):
            # Should handle lock error gracefully
            with outbox1.process_coalesced(is_synchronous_flush=True) as coalesced:
                assert coalesced is None

        # Original message should still exist
        assert RegionOutbox.objects.filter(id=outbox1.id).exists()

    def test_high_concurrency_reservation(self) -> None:
        """
        Simulate high-concurrency processing of a coalesced group.

        Create a group of outbox messages that share the same coalescing keys.
        Spawn several threads that call process_coalesced() concurrently.
        Verify that exactly one thread obtains the reservation (non-None result)
        while all others yield None.
        """
        from threading import Barrier, Thread

        # Create a coalesced group – two messages with identical coalescing fields.
        outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
        outbox2 = OrganizationMember(id=2, organization_id=3, user_id=1).outbox_for_update()
        for outbox in (outbox1, outbox2):
            outbox.shard_scope = OutboxScope.ORGANIZATION_SCOPE
            outbox.shard_identifier = 100
            outbox.category = OutboxCategory.ORGANIZATION_MEMBER_UPDATE
            outbox.object_identifier = 1
            # Make sure they are eligible (set scheduled_for in the past)
            outbox.scheduled_for = django_timezone.now() - timedelta(minutes=1)

        with outbox_context(flush=False):
            outbox1.save()
            outbox2.save()

        THREAD_COUNT = 10
        barrier = Barrier(THREAD_COUNT)
        results = []  # we'll store each thread's result here

        def worker() -> None:
            # wait for all threads to be ready
            barrier.wait()
            # Each thread will attempt to process the same group.
            with outbox1.process_coalesced(is_synchronous_flush=True) as result:
                results.append(result)

        threads = [Thread(target=worker) for _ in range(THREAD_COUNT)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Count how many threads got a valid (non-None) reservation.
        non_none = [res for res in results if res is not None]
        assert len(non_none) == 1, (
            f"Expected exactly one thread with a reservation, got {len(non_none)}. "
            f"Results: {results}"
        )

    def test_scheduled_for_prevents_reselection(self) -> None:
        """
        Verify that scheduled_for is updated to a future timestamp such that the reserved
        messages are no longer selected for processing by subsequent queries.

        The test creates a coalesced group, then calls process_coalesced() to update scheduled_for.
        Afterwards it queries for messages that would be eligible for processing (with scheduled_for <= now)
        and asserts that the group is not returned.
        """
        fixed_time = datetime(2022, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        with freeze_time(fixed_time):
            # Create two messages with the same coalescing keys.
            outbox1 = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
            outbox2 = OrganizationMember(id=2, organization_id=3, user_id=1).outbox_for_update()
            for outbox in (outbox1, outbox2):
                outbox.shard_scope = OutboxScope.ORGANIZATION_SCOPE
                outbox.shard_identifier = 100
                outbox.category = OutboxCategory.ORGANIZATION_MEMBER_UPDATE
                outbox.object_identifier = 1
                # Set scheduled_for in the past so that they are eligible.
                outbox.scheduled_for = fixed_time - timedelta(minutes=1)

            with outbox_context(flush=False):
                outbox1.save()
                outbox2.save()

        # Execute process_coalesced; when it executes the reservation update,
        # scheduled_for will be set to fixed_time + 1 hour.
        with outbox1.process_coalesced(is_synchronous_flush=True):
            # Reservation has been committed at this point.
            # Now, try to re-select messages from the same group that are eligible for processing.
            reserved = list(
                RegionOutbox.objects.filter(
                    shard_scope=outbox1.shard_scope,
                    shard_identifier=outbox1.shard_identifier,
                    category=outbox1.category,
                    object_identifier=outbox1.object_identifier,
                    scheduled_for__lte=django_timezone.now(),
                )
            )

        # Since the scheduled_for was updated to fixed_time + 1 hour, no message should be eligible.
        assert (
            len(reserved) == 0
        ), "Expected no re-selection of reserved messages, but found some eligible for processing."

    def test_process_coalesced_cleanup_on_signal_failure_no_deletion(self) -> None:
        """
        Test that if coalesced.send_signal() raises an exception, the cleanup
        does not delete the reserved (coalesced) message.

        In our current behavior the reserved message remains in the database.
        This test confirms that after a failure, the message is still present.
        """
        fixed_time = datetime(2022, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        with freeze_time(fixed_time):
            # Create a message that forms a coalesced group (with a single message).
            outbox = OrganizationMember(id=1, organization_id=3, user_id=1).outbox_for_update()
            outbox.shard_scope = OutboxScope.ORGANIZATION_SCOPE
            outbox.shard_identifier = 100
            outbox.category = OutboxCategory.ORGANIZATION_MEMBER_UPDATE
            outbox.object_identifier = 1
            # Set scheduled_for in the past to mark them eligible.
            outbox.scheduled_for = django_timezone.now() - timedelta(minutes=1)

            with outbox_context(flush=False):
                outbox.save()

        # Patch the send_signal method so that it raises an exception.
        # The expected behavior currently is that the cleanup phase does not delete the message.
        from unittest.mock import patch

        with patch.object(RegionOutbox, "send_signal", side_effect=ValueError("TEST ERROR")):
            with pytest.raises(ValueError, match="TEST ERROR"):
                with outbox.process_coalesced(is_synchronous_flush=True) as coalesced:
                    if coalesced:
                        coalesced.send_signal()

        # After the exception, check that the message has NOT been deleted.
        remaining = RegionOutbox.objects.filter(
            shard_scope=outbox.shard_scope,
            shard_identifier=outbox.shard_identifier,
            category=outbox.category,
            object_identifier=outbox.object_identifier,
        ).first()
        # In the current behavior, the reserved message remains in the database.
        assert remaining is not None, "Expected the reserved message to remain on error"

        assert remaining.scheduled_for == outbox.scheduled_from


class TestOutboxesManager(TestCase):
    def test_bulk_operations(self) -> None:
        org = self.create_organization()
        team = self.create_team(organization=org)
        members = [
            self.create_member(user_id=i + 1000, organization_id=org.id) for i in range(0, 10)
        ]
        do_not_touch = OrganizationMemberTeam(
            organizationmember=self.create_member(user_id=99, organization_id=org.id),
            team=team,
            role="ploy",
        )
        do_not_touch.save()

        OrganizationMemberTeam.objects.bulk_create(
            OrganizationMemberTeam(organizationmember=member, team=team) for member in members
        )

        with outbox_runner():
            assert RegionOutbox.objects.count() == 10
            assert OrganizationMemberTeam.objects.count() == 11
            with assume_test_silo_mode_of(OrganizationMemberTeamReplica):
                assert OrganizationMemberTeamReplica.objects.count() == 1

        assert RegionOutbox.objects.count() == 0
        assert OrganizationMemberTeam.objects.count() == 11
        with assume_test_silo_mode_of(OrganizationMemberTeamReplica):
            assert OrganizationMemberTeamReplica.objects.count() == 11

        existing = OrganizationMemberTeam.objects.all().exclude(id=do_not_touch.id).all()
        for obj in existing:
            obj.role = "cow"
        OrganizationMemberTeam.objects.bulk_update(existing, ["role"])

        with outbox_runner():
            assert RegionOutbox.objects.count() == 10
            with assume_test_silo_mode_of(OrganizationMemberTeamReplica):
                assert OrganizationMemberTeamReplica.objects.filter(role="cow").count() == 0

        assert RegionOutbox.objects.count() == 0
        with assume_test_silo_mode_of(OrganizationMemberTeamReplica):
            assert OrganizationMemberTeamReplica.objects.filter(role="cow").count() == 10

        OrganizationMemberTeam.objects.bulk_delete(existing)

        with outbox_runner():
            assert RegionOutbox.objects.count() == 10
            assert OrganizationMemberTeam.objects.count() == 1
            with assume_test_silo_mode_of(OrganizationMemberTeamReplica):
                assert OrganizationMemberTeamReplica.objects.count() == 11

        assert RegionOutbox.objects.count() == 0
        with assume_test_silo_mode_of(OrganizationMemberTeamReplica):
            assert OrganizationMemberTeamReplica.objects.count() == 1


@control_silo_test
class OutboxAggregationTest(TestCase):
    def setUp(self) -> None:
        shard_counts = {1: (4, "eu"), 2: (7, "us"), 3: (1, "us")}
        with outbox_runner():
            pass

        for shard_id, (shard_count, region_name) in shard_counts.items():
            for i in range(shard_count):
                ControlOutbox(
                    region_name=region_name,
                    shard_scope=OutboxScope.WEBHOOK_SCOPE,
                    shard_identifier=shard_id,
                    category=OutboxCategory.WEBHOOK_PROXY,
                    object_identifier=shard_id * 10000 + i,
                    payload={"foo": "bar"},
                ).save()

    def test_calculate_sharding_depths(self) -> None:
        shard_depths = ControlOutbox.get_shard_depths_descending()

        assert shard_depths == [
            dict(
                shard_identifier=2,
                region_name="us",
                shard_scope=OutboxScope.WEBHOOK_SCOPE.value,
                depth=7,
            ),
            dict(
                shard_identifier=1,
                region_name="eu",
                shard_scope=OutboxScope.WEBHOOK_SCOPE.value,
                depth=4,
            ),
            dict(
                shard_identifier=3,
                region_name="us",
                shard_scope=OutboxScope.WEBHOOK_SCOPE.value,
                depth=1,
            ),
        ]

        # Test limiting the query to a single entry
        shard_depths = ControlOutbox.get_shard_depths_descending(limit=1)
        assert shard_depths == [
            dict(
                shard_identifier=2,
                region_name="us",
                shard_scope=OutboxScope.WEBHOOK_SCOPE.value,
                depth=7,
            )
        ]

    def test_calculate_sharding_depths_empty(self) -> None:
        ControlOutbox.objects.all().delete()
        assert ControlOutbox.objects.count() == 0
        assert ControlOutbox.get_shard_depths_descending() == []

    def test_total_count(self) -> None:
        assert ControlOutbox.get_total_outbox_count() == 7 + 4 + 1
