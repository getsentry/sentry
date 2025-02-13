import functools
import threading
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import Mock, call, patch

import pytest
from django.db import connections
from django.test import RequestFactory
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
from sentry.testutils.helpers.options import override_options
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
        outbox2 = Organization(id=1).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()
        barrier: threading.Barrier = threading.Barrier(2, timeout=10)
        processing_thread = threading.Thread(
            target=wrap_with_connection_closure(
                lambda: outbox1.drain_shard(_test_processing_barrier=barrier)
            )
        )
        processing_thread.start()

        barrier.wait()

        # Does not include outboxes created after starting process.
        with outbox_context(flush=False):
            outbox2.save()
        barrier.wait()

        processing_thread.join(timeout=1)
        assert not RegionOutbox.objects.filter(id=outbox1.id).first()
        assert RegionOutbox.objects.filter(id=outbox2.id).first()

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
        barrier: threading.Barrier = threading.Barrier(2, timeout=10)
        processing_thread = threading.Thread(
            target=wrap_with_connection_closure(
                lambda: outbox1.drain_shard(flush_all=True, _test_processing_barrier=barrier)
            )
        )
        processing_thread.start()

        barrier.wait()

        # Does include outboxes created after starting process.
        with outbox_context(flush=False):
            outbox2.save()
        barrier.wait()

        # Next iteration
        barrier.wait()
        barrier.wait()

        processing_thread.join(timeout=1)
        assert not RegionOutbox.objects.filter(id=outbox1.id).first()
        assert not RegionOutbox.objects.filter(id=outbox2.id).first()

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


class OutboxDrainReservationTest(TransactionTestCase):
    @patch("sentry.hybridcloud.models.outbox.process_region_outbox.send")
    def test_draining_with_disabled_shards(self, mock_send: Mock) -> None:
        outbox1 = Organization(id=1).outbox_for_update()
        outbox2 = Organization(id=1).outbox_for_update()
        outbox3 = Organization(id=2).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()
            outbox2.save()
            outbox3.save()

        with self.options(
            {
                "hybrid_cloud.outbox.reservation_shards": [outbox1.shard_scope],
                "hybrid_cloud.authentication.disabled_organization_shards": [1],
            }
        ):
            outbox1.drain_shard()
            with pytest.raises(RegionOutbox.DoesNotExist):
                outbox1.refresh_from_db()
            outbox2.refresh_from_db()  # still exists

            assert mock_send.call_count == 0

            outbox3.drain_shard()
            with pytest.raises(RegionOutbox.DoesNotExist):
                outbox3.refresh_from_db()

            assert mock_send.call_count == 1

    @override_options(
        {"hybrid_cloud.outbox.reservation_shards": [OutboxScope.ORGANIZATION_SCOPE.value]}
    )
    def test_drain_shard_not_flush_all__upper_bound(self) -> None:
        outbox1 = Organization(id=1).outbox_for_update()
        outbox2 = Organization(id=1).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()
        barrier: threading.Barrier = threading.Barrier(2, timeout=10)
        processing_thread = threading.Thread(
            target=wrap_with_connection_closure(
                lambda: outbox1.drain_shard(_test_processing_barrier=barrier)
            )
        )
        processing_thread.start()

        barrier.wait()

        # Does not include outboxes created after starting process.
        with outbox_context(flush=False):
            outbox2.save()
        barrier.wait()

        processing_thread.join(timeout=1)
        assert not RegionOutbox.objects.filter(id=outbox1.id).first()
        assert RegionOutbox.objects.filter(id=outbox2.id).first()

    @patch("sentry.hybridcloud.models.outbox.process_region_outbox.send")
    @override_options(
        {"hybrid_cloud.outbox.reservation_shards": [OutboxScope.ORGANIZATION_SCOPE.value]}
    )
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

    @override_options(
        {"hybrid_cloud.outbox.reservation_shards": [OutboxScope.ORGANIZATION_SCOPE.value]}
    )
    def test_drain_shard_flush_all__upper_bound(self) -> None:
        outbox1 = Organization(id=1).outbox_for_update()
        outbox2 = Organization(id=1).outbox_for_update()

        with outbox_context(flush=False):
            outbox1.save()
        barrier: threading.Barrier = threading.Barrier(2, timeout=10)
        processing_thread = threading.Thread(
            target=wrap_with_connection_closure(
                lambda: outbox1.drain_shard(flush_all=True, _test_processing_barrier=barrier)
            )
        )
        processing_thread.start()

        barrier.wait()

        # Does include outboxes created after starting process.
        with outbox_context(flush=False):
            outbox2.save()
        barrier.wait()

        # Next iteration
        barrier.wait()
        barrier.wait()

        processing_thread.join(timeout=1)
        assert not RegionOutbox.objects.filter(id=outbox1.id).first()
        assert not RegionOutbox.objects.filter(id=outbox2.id).first()

    @override_options(
        {"hybrid_cloud.outbox.reservation_shards": [OutboxScope.ORGANIZATION_SCOPE.value]}
    )
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


class RegionOutboxTest(TestCase):
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

    @patch("sentry.hybridcloud.models.outbox.metrics")
    def test_concurrent_coalesced_object_processing(self, mock_metrics: Mock) -> None:
        # Two objects coalesced
        outbox = OrganizationMember(id=1, organization_id=1).outbox_for_update()
        with outbox_context(flush=False):
            outbox.save()
            OrganizationMember(id=1, organization_id=1).outbox_for_update().save()

            # Unrelated
            OrganizationMember(organization_id=1, id=2).outbox_for_update().save()
            OrganizationMember(organization_id=2, id=2).outbox_for_update().save()

        assert len(list(RegionOutbox.find_scheduled_shards())) == 2

        ctx = outbox.process_coalesced(is_synchronous_flush=True)
        try:
            ctx.__enter__()
            assert RegionOutbox.objects.count() == 4
            assert outbox.select_coalesced_messages().count() == 2

            # concurrent write of coalesced object update.
            with outbox_context(flush=False):
                OrganizationMember(organization_id=1, id=1).outbox_for_update().save()
            assert RegionOutbox.objects.count() == 5
            assert outbox.select_coalesced_messages().count() == 3

            ctx.__exit__(None, None, None)

            # does not remove the concurrent write, which is still going to update.
            assert RegionOutbox.objects.count() == 3
            assert outbox.select_coalesced_messages().count() == 1
            assert len(list(RegionOutbox.find_scheduled_shards())) == 2

            expected = [
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call("outbox.saved", 1, tags={"category": "ORGANIZATION_MEMBER_UPDATE"}),
                call(
                    "outbox.processed",
                    2,
                    tags={"category": "ORGANIZATION_MEMBER_UPDATE", "synchronous": 1},
                ),
            ]
            assert mock_metrics.incr.mock_calls == expected
        except Exception as e:
            ctx.__exit__(type(e), e, None)
            raise

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
