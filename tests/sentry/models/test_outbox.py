import dataclasses
import functools
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, ContextManager
from unittest.mock import call, patch

import pytest
import responses
from django.conf import settings
from django.db import connections
from django.test import RequestFactory
from pytest import raises
from rest_framework import status

from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.organizationmemberteamreplica import OrganizationMemberTeamReplica
from sentry.models.outbox import (
    ControlOutbox,
    OutboxCategory,
    OutboxFlushError,
    OutboxScope,
    RegionOutbox,
    WebhookProviderIdentifier,
    outbox_context,
)
from sentry.models.user import User
from sentry.silo import SiloMode
from sentry.tasks.deliver_from_outbox import enqueue_outbox_jobs
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.region import override_regions
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, region_silo_test
from sentry.types.region import Region, RegionCategory, get_local_region


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
@pytest.mark.django_db(transaction=True)
def setup_clear_fixture_outbox_messages():
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

    def test_control_sharding_keys(self):
        request = RequestFactory().get("/extensions/slack/webhook/")
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

            for inst in ControlOutbox.for_webhook_update(
                webhook_identifier=WebhookProviderIdentifier.SLACK,
                region_names=[settings.SENTRY_MONOLITH_REGION, "special-slack-region"],
                request=request,
            ):
                inst.save()

            for inst in ControlOutbox.for_webhook_update(
                webhook_identifier=WebhookProviderIdentifier.GITHUB,
                region_names=[settings.SENTRY_MONOLITH_REGION, "special-github-region"],
                request=request,
            ):
                inst.save()

        shards = {
            (row["shard_scope"], row["shard_identifier"], row["region_name"])
            for row in ControlOutbox.find_scheduled_shards()
        }

        assert shards == {
            (OutboxScope.USER_SCOPE.value, user1.id, expected_region_name),
            (OutboxScope.USER_SCOPE.value, user2.id, expected_region_name),
            (
                OutboxScope.WEBHOOK_SCOPE.value,
                WebhookProviderIdentifier.SLACK,
                settings.SENTRY_MONOLITH_REGION,
            ),
            (
                OutboxScope.WEBHOOK_SCOPE.value,
                WebhookProviderIdentifier.GITHUB,
                settings.SENTRY_MONOLITH_REGION,
            ),
            (
                OutboxScope.WEBHOOK_SCOPE.value,
                WebhookProviderIdentifier.SLACK,
                "special-slack-region",
            ),
            (
                OutboxScope.WEBHOOK_SCOPE.value,
                WebhookProviderIdentifier.GITHUB,
                "special-github-region",
            ),
        }

    def test_prepare_next_from_shard_no_conflict_with_processing(self):
        with outbox_runner():
            org = Factories.create_organization()
            user1 = Factories.create_user()
            Factories.create_member(organization_id=org.id, user_id=user1.id)

        with outbox_context(flush=False):
            outbox = user1.outboxes_for_update()[0]
            outbox.save()
            with outbox.process_shard(None) as next_shard_row:
                assert next_shard_row is not None

                def test_with_other_connection():
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

    def test_control_outbox_for_webhooks(self):
        [outbox] = ControlOutbox.for_webhook_update(
            webhook_identifier=WebhookProviderIdentifier.GITHUB,
            region_names=["webhook-region"],
            request=self.webhook_request,
        )
        assert outbox.shard_scope == OutboxScope.WEBHOOK_SCOPE
        assert outbox.shard_identifier == WebhookProviderIdentifier.GITHUB
        assert outbox.category == OutboxCategory.WEBHOOK_PROXY
        assert outbox.region_name == "webhook-region"

        payload_from_request = outbox.get_webhook_payload_from_request(self.webhook_request)
        assert outbox.payload == dataclasses.asdict(payload_from_request)
        payload_from_outbox = outbox.get_webhook_payload_from_outbox(outbox.payload)
        assert payload_from_request == payload_from_outbox

        assert outbox.payload["method"] == "POST"
        assert outbox.payload["path"] == "/extensions/github/webhook/?query=test"
        assert outbox.payload["uri"] == "http://testserver/extensions/github/webhook/?query=test"
        # Request factory expects transformed headers, but the outbox stores raw headers
        assert outbox.payload["headers"]["X-Github-Emoticon"] == ">:^]"
        assert outbox.payload["body"] == '{"installation": {"id": "github:1"}}'

        # After saving, data shouldn't mutate
        with outbox_context(flush=False):
            outbox.save()
        outbox = ControlOutbox.objects.all().first()
        assert outbox.payload["method"] == "POST"
        assert outbox.payload["path"] == "/extensions/github/webhook/?query=test"
        assert outbox.payload["uri"] == "http://testserver/extensions/github/webhook/?query=test"
        # Request factory expects transformed headers, but the outbox stores raw headers
        assert outbox.payload["headers"]["X-Github-Emoticon"] == ">:^]"
        assert outbox.payload["body"] == '{"installation": {"id": "github:1"}}'

    @responses.activate
    def test_drains_successful_success(self):
        with override_regions(self.region_config):
            mock_response = responses.add(
                self.webhook_request.method,
                f"{self.region.address}{self.webhook_request.path}",
                status=status.HTTP_200_OK,
            )
            expected_request_count = 1 if SiloMode.get_current_mode() == SiloMode.CONTROL else 0
            [outbox] = ControlOutbox.for_webhook_update(
                webhook_identifier=WebhookProviderIdentifier.GITHUB,
                region_names=[self.region.name],
                request=self.webhook_request,
            )
            with outbox_context(flush=False):
                outbox.save()

            assert ControlOutbox.objects.filter(id=outbox.id).exists()
            outbox.drain_shard()
            assert mock_response.call_count == expected_request_count
            assert not ControlOutbox.objects.filter(id=outbox.id).exists()

    @responses.activate
    def test_drains_webhook_failure(self):
        with override_regions(self.region_config):
            mock_response = responses.add(
                self.webhook_request.method,
                f"{self.region.address}{self.webhook_request.path}",
                status=status.HTTP_502_BAD_GATEWAY,
            )
            [outbox] = ControlOutbox.for_webhook_update(
                webhook_identifier=WebhookProviderIdentifier.GITHUB,
                region_names=[self.region.name],
                request=self.webhook_request,
            )
            with outbox_context(flush=False):
                outbox.save()

            assert ControlOutbox.objects.filter(id=outbox.id).exists()
            if SiloMode.get_current_mode() == SiloMode.CONTROL:
                with raises(OutboxFlushError):
                    outbox.drain_shard()
                assert mock_response.call_count == 1
                assert ControlOutbox.objects.filter(id=outbox.id).exists()
            else:
                outbox.drain_shard()
                assert mock_response.call_count == 0
                assert not ControlOutbox.objects.filter(id=outbox.id).exists()


@region_silo_test
class OutboxDrainTest(TransactionTestCase):
    def test_drain_shard_not_flush_all__upper_bound(self):
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

    @patch("sentry.models.outbox.process_region_outbox.send")
    def test_drain_shard_not_flush_all__concurrent_processing(self, mock_process_region_outbox):
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

    def test_drain_shard_flush_all__upper_bound(self):
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

    @patch("sentry.models.outbox.process_region_outbox.send")
    def test_drain_shard_flush_all__concurrent_processing__cooperation(
        self, mock_process_region_outbox
    ):
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


@region_silo_test
class RegionOutboxTest(TestCase):
    def test_creating_org_outboxes(self):
        with outbox_context(flush=False):
            Organization(id=10).outbox_for_update().save()
            OrganizationMember(organization_id=12, id=15).outbox_for_update().save()
        assert RegionOutbox.objects.count() == 2

        with outbox_runner():
            # drain outboxes
            pass
        assert RegionOutbox.objects.count() == 0

    @patch("sentry.models.outbox.metrics")
    def test_concurrent_coalesced_object_processing(self, mock_metrics):
        # Two objects coalesced
        outbox = OrganizationMember(id=1, organization_id=1).outbox_for_update()
        with outbox_context(flush=False):
            outbox.save()
            OrganizationMember(id=1, organization_id=1).outbox_for_update().save()

            # Unrelated
            OrganizationMember(organization_id=1, id=2).outbox_for_update().save()
            OrganizationMember(organization_id=2, id=2).outbox_for_update().save()

        assert len(list(RegionOutbox.find_scheduled_shards())) == 2

        ctx: ContextManager = outbox.process_coalesced(is_synchronous_flush=True)
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
            raise e

    def test_outbox_rescheduling(self):
        with patch("sentry.models.outbox.process_region_outbox.send") as mock_process_region_outbox:

            def raise_exception(**kwds):
                raise ValueError("This is just a test mock exception")

            def run_with_error(concurrency=1):
                mock_process_region_outbox.side_effect = raise_exception
                mock_process_region_outbox.reset_mock()
                with self.tasks():
                    with raises(OutboxFlushError):
                        enqueue_outbox_jobs(concurrency=concurrency, process_outbox_backfills=False)
                    assert mock_process_region_outbox.call_count == 1

            def ensure_converged():
                mock_process_region_outbox.reset_mock()
                with self.tasks():
                    enqueue_outbox_jobs(process_outbox_backfills=False)
                    assert mock_process_region_outbox.call_count == 0

            def assert_called_for_org(org):
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

    def test_outbox_converges(self):
        with patch(
            "sentry.models.outbox.process_region_outbox.send"
        ) as mock_process_region_outbox, outbox_context(flush=False):
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

    def test_region_sharding_keys(self):
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

    def test_scheduling_with_future_outbox_time(self):
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

    def test_scheduling_with_past_and_future_outbox_times(self):
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
    def test_bulk_operations(self):
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
            assert OrganizationMemberTeamReplica.objects.count() == 1
            assert OrganizationMemberTeam.objects.count() == 11

        assert RegionOutbox.objects.count() == 0
        assert OrganizationMemberTeamReplica.objects.count() == 11
        assert OrganizationMemberTeam.objects.count() == 11

        existing = OrganizationMemberTeam.objects.all().exclude(id=do_not_touch.id).all()
        for obj in existing:
            obj.role = "cow"
        OrganizationMemberTeam.objects.bulk_update(existing, ["role"])

        with outbox_runner():
            assert RegionOutbox.objects.count() == 10
            assert OrganizationMemberTeamReplica.objects.filter(role="cow").count() == 0

        assert RegionOutbox.objects.count() == 0
        assert OrganizationMemberTeamReplica.objects.filter(role="cow").count() == 10

        OrganizationMemberTeam.objects.bulk_delete(existing)

        with outbox_runner():
            assert RegionOutbox.objects.count() == 10
            assert OrganizationMemberTeamReplica.objects.count() == 11
            assert OrganizationMemberTeam.objects.count() == 1

        assert RegionOutbox.objects.count() == 0
        assert OrganizationMemberTeamReplica.objects.count() == 1
