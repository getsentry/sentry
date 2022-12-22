import threading
import time
from typing import ContextManager

import pytest

from sentry.models import (
    MONOLITH_REGION_NAME,
    ControlOutbox,
    OutboxScope,
    RegionOutbox,
    WebhookProviderIdentifier,
)
from sentry.testutils.factories import Factories
from sentry.testutils.silo import control_silo_test, region_silo_test


@pytest.mark.django_db(transaction=True)
@region_silo_test(stable=True)
def test_region_creates_outbox_objects():
    assert RegionOutbox.objects.count() == 0

    org1 = Factories.create_organization()
    assert RegionOutbox.objects.count() == 0

    org1.name = "New name cool beans"
    org1.save()
    assert RegionOutbox.objects.count() == 1

    user = Factories.create_user()
    Factories.create_member(user=user, organization=org1)
    assert RegionOutbox.objects.count() == 2


@pytest.mark.django_db(transaction=True)
@control_silo_test(stable=True)
def test_control_creates_outbox_objects():
    org = Factories.create_organization()
    Factories.create_org_mapping(org)

    assert ControlOutbox.objects.count() == 0

    user1 = Factories.create_user()
    Factories.create_member(organization=org, user=user1)
    assert ControlOutbox.objects.count() == 0

    user1.delete()
    assert ControlOutbox.objects.count() == 1


@pytest.mark.django_db(transaction=True)
@region_silo_test(stable=True)
def test_processing_is_serialized():
    org1 = Factories.create_organization()
    org1.name = "New name cool beans"
    org1.save()

    def try_to_beat_processing():
        outbox: RegionOutbox = RegionOutbox.objects.last()
        assert not outbox.process()

    outbox: RegionOutbox = RegionOutbox.objects.last()
    ctx: ContextManager = outbox.process_serialized()
    try:
        ctx.__enter__()
        assert RegionOutbox.objects.count() == 1
        thread = threading.Thread(target=try_to_beat_processing)
        thread.start()
        time.sleep(3)
        assert thread.is_alive()
        ctx.__exit__(None, None, None)
        assert RegionOutbox.objects.count() == 0
        thread.join(5)
    except Exception as e:
        ctx.__exit__(type(e), e, None)
        raise e


@pytest.mark.django_db(transaction=True)
@region_silo_test(stable=True)
def test_region_sharding_keys():
    org1 = Factories.create_organization()
    org2 = Factories.create_organization()

    RegionOutbox.for_model_update(org1).save()
    RegionOutbox.for_model_update(org2).save()

    user1 = Factories.create_user()
    # these should create their outboxes automatically.
    Factories.create_member(organization=org1, user=user1)
    Factories.create_member(organization=org2, user=user1)

    shards = {
        (row["scope"], row["scope_identifier"]) for row in RegionOutbox.find_scheduled_shards()
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
    Factories.create_member(organization=org, user=user1)
    for inst in ControlOutbox.for_model_update(user1):
        inst.save()

    user2 = Factories.create_user()
    Factories.create_member(organization=org, user=user2)
    for inst in ControlOutbox.for_model_update(user2):
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
        (row["scope"], row["scope_identifier"], row["region_name"])
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
