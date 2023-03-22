from datetime import datetime, timedelta
from typing import ContextManager
from unittest.mock import patch

import pytest
from freezegun import freeze_time
from pytest import raises

from sentry.models import (
    ControlOutbox,
    Organization,
    OrganizationMember,
    OutboxCategory,
    OutboxScope,
    RegionOutbox,
    User,
    WebhookProviderIdentifier,
)
from sentry.silo import SiloMode
from sentry.tasks.deliver_from_outbox import enqueue_outbox_jobs
from sentry.testutils.factories import Factories
from sentry.testutils.silo import control_silo_test, region_silo_test
from sentry.types.region import MONOLITH_REGION_NAME


@pytest.mark.django_db(transaction=True)
@region_silo_test(stable=True)
def test_creating_org_outboxes():
    Organization.outbox_for_update(10).save()
    OrganizationMember.outbox_for_update(12, 15).save()
    assert RegionOutbox.objects.count() == 2


@pytest.mark.django_db(transaction=True)
@control_silo_test(stable=True)
def test_creating_user_outboxes():
    org = Factories.create_organization()
    Factories.create_org_mapping(org, region_name="a")
    user1 = Factories.create_user()
    Factories.create_member(organization=org, user=user1)

    org2 = Factories.create_organization()
    Factories.create_org_mapping(org2, region_name="b")
    Factories.create_member(organization=org2, user=user1)

    for outbox in User.outboxes_for_update(user1.id):
        outbox.save()

    expected_counts = 1 if SiloMode.get_current_mode() == SiloMode.MONOLITH else 2
    assert ControlOutbox.objects.count() == expected_counts


@pytest.mark.django_db(transaction=True)
@region_silo_test(stable=True)
def test_concurrent_coalesced_object_processing():
    # Two objects coalesced
    outbox = OrganizationMember.outbox_for_update(org_id=1, org_member_id=1)
    outbox.save()
    OrganizationMember.outbox_for_update(org_id=1, org_member_id=1).save()

    # Unrelated
    OrganizationMember.outbox_for_update(org_id=1, org_member_id=2).save()
    OrganizationMember.outbox_for_update(org_id=2, org_member_id=2).save()

    assert len(list(RegionOutbox.find_scheduled_shards())) == 2

    ctx: ContextManager = outbox.process_coalesced()
    try:
        ctx.__enter__()
        assert RegionOutbox.objects.count() == 4
        assert outbox.select_coalesced_messages().count() == 2

        # concurrent write of coalesced object update.
        OrganizationMember.outbox_for_update(org_id=1, org_member_id=1).save()
        assert RegionOutbox.objects.count() == 5
        assert outbox.select_coalesced_messages().count() == 3

        ctx.__exit__(None, None, None)

        # does not remove the concurrent write, which is still going to update.
        assert RegionOutbox.objects.count() == 3
        assert outbox.select_coalesced_messages().count() == 1
        assert len(list(RegionOutbox.find_scheduled_shards())) == 2
    except Exception as e:
        ctx.__exit__(type(e), e, None)
        raise e


@pytest.mark.django_db(transaction=True)
@region_silo_test(stable=True)
def test_region_sharding_keys():
    org1 = Factories.create_organization()
    org2 = Factories.create_organization()

    Organization.outbox_for_update(org1.id).save()
    Organization.outbox_for_update(org2.id).save()

    OrganizationMember.outbox_for_update(org_id=org1.id, org_member_id=1).save()
    OrganizationMember.outbox_for_update(org_id=org2.id, org_member_id=2).save()

    shards = {
        (row["shard_scope"], row["shard_identifier"])
        for row in RegionOutbox.find_scheduled_shards()
    }
    assert shards == {
        (OutboxScope.ORGANIZATION_SCOPE.value, org1.id),
        (OutboxScope.ORGANIZATION_SCOPE.value, org2.id),
    }


@pytest.mark.django_db(transaction=True)
@control_silo_test(stable=True)
def test_control_sharding_keys():
    org = Factories.create_organization()
    Factories.create_org_mapping(org, region_name=MONOLITH_REGION_NAME)
    user1 = Factories.create_user()
    user2 = Factories.create_user()
    Factories.create_member(organization=org, user=user1)
    Factories.create_member(organization=org, user=user2)

    for inst in User.outboxes_for_update(user1.id):
        inst.save()
    for inst in User.outboxes_for_update(user2.id):
        inst.save()

    for inst in ControlOutbox.for_webhook_update(
        webhook_identifier=WebhookProviderIdentifier.SLACK,
        region_names=[MONOLITH_REGION_NAME, "special-slack-region"],
    ):
        inst.save()

    for inst in ControlOutbox.for_webhook_update(
        webhook_identifier=WebhookProviderIdentifier.GITHUB,
        region_names=[MONOLITH_REGION_NAME, "special-github-region"],
    ):
        inst.save()

    shards = {
        (row["shard_scope"], row["shard_identifier"], row["region_name"])
        for row in ControlOutbox.find_scheduled_shards()
    }
    assert shards == {
        (OutboxScope.USER_SCOPE.value, user1.id, MONOLITH_REGION_NAME),
        (OutboxScope.USER_SCOPE.value, user2.id, MONOLITH_REGION_NAME),
        (OutboxScope.WEBHOOK_SCOPE.value, WebhookProviderIdentifier.SLACK, MONOLITH_REGION_NAME),
        (OutboxScope.WEBHOOK_SCOPE.value, WebhookProviderIdentifier.GITHUB, MONOLITH_REGION_NAME),
        (OutboxScope.WEBHOOK_SCOPE.value, WebhookProviderIdentifier.SLACK, "special-slack-region"),
        (
            OutboxScope.WEBHOOK_SCOPE.value,
            WebhookProviderIdentifier.GITHUB,
            "special-github-region",
        ),
    }


@pytest.mark.django_db(transaction=True)
@region_silo_test(stable=True)
def test_outbox_rescheduling(task_runner):
    with patch("sentry.models.outbox.process_region_outbox.send") as mock_process_region_outbox:

        def raise_exception(**kwds):
            raise ValueError("This is just a test mock exception")

        def run_with_error():
            mock_process_region_outbox.side_effect = raise_exception
            mock_process_region_outbox.reset_mock()
            with task_runner():
                with raises(ValueError):
                    enqueue_outbox_jobs()
                assert mock_process_region_outbox.call_count == 1

        def ensure_converged():
            mock_process_region_outbox.reset_mock()
            with task_runner():
                enqueue_outbox_jobs()
                assert mock_process_region_outbox.call_count == 0

        def assert_called_for_org(org):
            mock_process_region_outbox.assert_called_with(
                sender=OutboxCategory.ORGANIZATION_UPDATE,
                payload=None,
                object_identifier=org,
            )

        Organization.outbox_for_update(org_id=10001).save()
        Organization.outbox_for_update(org_id=10002).save()

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

            # Concurrently added items still follow the largest retry schedule
            Organization.outbox_for_update(10002).save()
            ensure_converged()


@pytest.mark.django_db(transaction=True)
@region_silo_test(stable=True)
def test_outbox_converges(task_runner):
    with patch("sentry.models.outbox.process_region_outbox.send") as mock_process_region_outbox:
        Organization.outbox_for_update(10001).save()
        Organization.outbox_for_update(10001).save()

        Organization.outbox_for_update(10002).save()
        Organization.outbox_for_update(10002).save()

        last_call_count = 0
        while True:
            with task_runner():
                enqueue_outbox_jobs()
                if last_call_count == mock_process_region_outbox.call_count:
                    break
                last_call_count = mock_process_region_outbox.call_count

        assert last_call_count == 2
