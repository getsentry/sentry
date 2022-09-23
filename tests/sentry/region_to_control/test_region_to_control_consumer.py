import dataclasses
import datetime
import logging

import pytest

from sentry.models import UserIP
from sentry.region_to_control.consumer import RegionToControlConsumerWorker
from sentry.region_to_control.messages import RegionToControlMessage, UserIpEvent
from sentry.testutils.factories import Factories

logger = logging.getLogger(__name__)


@pytest.fixture
def region_to_control_consumer_worker():
    return RegionToControlConsumerWorker()


@pytest.fixture
def user():
    return Factories.create_user("admin@localhost")


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
