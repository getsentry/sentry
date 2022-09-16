import dataclasses
import datetime
import logging
import random

import pytest
from django.conf import settings
from django.test import override_settings

from sentry.models import UserIP
from sentry.region_to_control.consumer import (
    RegionToControlConsumerWorker,
    get_region_to_control_consumer,
)
from sentry.region_to_control.messages import RegionToControlMessage, UserIpEvent
from sentry.region_to_control.producer import produce_user_ip
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
from sentry.utils.batching_kafka_consumer import create_topics

logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100


@pytest.fixture
def random_group_id():
    return f"test-consumer-{random.randint(0, 2 ** 16)}"


@pytest.fixture
def region_to_control_consumer(random_group_id):
    # For testing, get this topic created.
    create_topics(
        settings.KAFKA_TOPICS[settings.KAFKA_REGION_TO_CONTROL]["cluster"],
        [settings.KAFKA_REGION_TO_CONTROL],
    )

    with override_settings(SILO_MODE=SiloMode.CONTROL):
        consumer = get_region_to_control_consumer(
            "_local", group_id=random_group_id, auto_offset_reset="earliest"
        )

        consumer._run_once()

        return consumer


@pytest.fixture
def region_to_control_consumer_worker():
    return RegionToControlConsumerWorker()


@pytest.fixture
def user():
    return Factories.create_user("admin@localhost")


@pytest.mark.django_db(transaction=True)
def test_region_to_control_user_ip(
    kafka_producer,
    kafka_admin,
    region_to_control_consumer,
    user,
):
    with override_settings(SILO_MODE=SiloMode.REGION):
        produce_user_ip(
            UserIpEvent(
                user_id=user.id,
                ip_address="127.0.0.1",
                last_seen=datetime.datetime(2000, 1, 1),
                country_code="US",
                region_code="CA",
            )
        )

    user_ip = UserIP.objects.last()
    assert user_ip is None

    for i in range(MAX_POLL_ITERATIONS):
        user_ip = UserIP.objects.last()
        if user_ip:
            break
        region_to_control_consumer._run_once()
    else:
        raise AssertionError("region_to_control_consumer never successfully processed user ip!")

    assert user_ip.user.id == user.id
    assert user_ip.ip_address == "127.0.0.1"
    assert user_ip.last_seen == datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)
    assert user_ip.country_code == "US"
    assert user_ip.region_code == "CA"


@pytest.mark.django_db(transaction=True)
def test_user_ip_event_with_deleted_user(region_to_control_consumer_worker, user):
    message = RegionToControlMessage(
        user_ip_event=UserIpEvent(
            user_id=user.id, ip_address="127.0.0.1", last_seen=datetime.datetime.now()
        )
    )
    region_to_control_consumer_worker.flush_batch([message])

    assert UserIP.objects.count() == 1

    user.delete()

    region_to_control_consumer_worker.flush_batch([message])

    assert UserIP.objects.count() == 0


@pytest.mark.django_db
def test_no_op_message(region_to_control_consumer_worker, user):
    assert dataclasses.asdict(RegionToControlMessage()) == dict(user_ip_event=None)

    region_to_control_consumer_worker.flush_batch([RegionToControlMessage()])

    assert UserIP.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    "user_ip_event",
    [
        lambda user: ({"user_id": user.id, "ip_address": "127.0.0.1", "dropped_column": 123}),
        lambda user: (
            {
                "user_id": user.id,
                "ip_address": "127.0.0.1",
                "last_seen": "2000-01-01T00:00:00.000000Z",
                "country_code": "US",
                "region_code": "CA",
            }
        ),
    ],
)
def test_user_ip_event_regression(region_to_control_consumer_worker, user, user_ip_event):
    region_to_control_consumer_worker.flush_batch(
        [RegionToControlMessage.from_payload(dict(user_ip_event=user_ip_event(user)))]
    )

    assert UserIP.objects.count() == 1
