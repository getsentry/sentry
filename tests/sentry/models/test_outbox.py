import threading
import time
from typing import ContextManager

import pytest

from sentry.models import (
    MONOLITH_REGION_NAME,
    ControlOutbox,
    RegionOutbox,
    WebhookProviderIdentifier,
)
from sentry.tasks.deliver_from_outbox import enqueue_outbox_jobs
from sentry.testutils.factories import Factories


@pytest.mark.django_db(transaction=True)
def test_creates_outbox_objects():
    assert RegionOutbox.objects.count() == 0
    assert ControlOutbox.objects.count() == 0

    org1 = Factories.create_organization()
    assert RegionOutbox.objects.count() == 0
    assert ControlOutbox.objects.count() == 0

    org1.name = "New name cool beans"
    org1.save()
    assert RegionOutbox.objects.count() == 1
    assert ControlOutbox.objects.count() == 0

    user1 = Factories.create_user()
    assert RegionOutbox.objects.count() == 1
    assert ControlOutbox.objects.count() == 0

    user1.delete()
    assert RegionOutbox.objects.count() == 1
    assert ControlOutbox.objects.count() == 1

    user2 = Factories.create_user()
    Factories.create_member(user=user2, organization=org1)
    assert RegionOutbox.objects.count() == 2
    assert ControlOutbox.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_delivery_runs_even_with_empty_box(task_runner):
    with task_runner():
        enqueue_outbox_jobs()


@pytest.mark.django_db(transaction=True)
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
        assert thread.isAlive()
        ctx.__exit__(None, None, None)
        assert RegionOutbox.objects.count() == 0
        thread.join(5)
    except Exception as e:
        ctx.__exit__(type(e), e, None)


@pytest.mark.django_db(transaction=True)
def test_scheduling():
    org1 = Factories.create_organization()
    org2 = Factories.create_organization()

    RegionOutbox.for_model_update(org1).save()
    RegionOutbox.for_model_update(org2).save()

    user1 = Factories.create_user()
    for inst in ControlOutbox.for_model_update(user1):
        inst.save()

    user2 = Factories.create_user()
    for inst in ControlOutbox.for_model_update(user2):
        inst.save()

    # these should create their outboxes automatically.
    # org_member1 = Factories.create_member(organization=org1, user=user1)
    # org_member2 = Factories.create_member(organization=org2, user=user2)

    for i in range(2):
        for inst in ControlOutbox.for_webhook_update(
            webhook_identifier=WebhookProviderIdentifier.SLACK,
            region_names=[MONOLITH_REGION_NAME],
        ):
            inst.save()

    assert RegionOutbox.find_scheduled_shards() == []
