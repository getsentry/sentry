import dataclasses
import datetime
import logging

import pytest

from sentry.models import ApiKey, AuditLogEntry, UserIP
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


@pytest.fixture
def organization(user):
    return Factories.create_organization("test-organization", owner=user)


@pytest.fixture
def api_key(organization):
    return ApiKey.objects.create(organization=organization, key="the-greatest-api-ever-known")


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


@pytest.mark.django_db(transaction=True)
def test_actor_key_not_serializable(api_key, user, organization):
    # Passes with no actor key,
    AuditLogEntry(actor=user, actor_key=None, organization=organization, event=1).as_kafka_event()
    # Fails with one.
    with pytest.raises(ValueError):
        AuditLogEntry(
            actor=user, actor_key=api_key, organization=organization, event=1
        ).as_kafka_event()


@pytest.mark.django_db(transaction=True)
def test_region_to_control_with_deleted_user(region_to_control_consumer_worker, user, organization):
    assert AuditLogEntry.objects.count() == 0

    message = RegionToControlMessage(
        audit_log_event=AuditLogEntry(
            actor=user,
            ip_address="127.0.0.1",
            organization=organization,
            event=0,
        ).as_kafka_event()
    )
    region_to_control_consumer_worker.flush_batch([message])

    assert AuditLogEntry.objects.count() == 1
    assert AuditLogEntry.objects.first().actor_id is not None

    # This does not cascade, but sets null
    user.delete()
    assert AuditLogEntry.objects.count() == 1

    region_to_control_consumer_worker.flush_batch([message])

    assert AuditLogEntry.objects.count() == 2

    assert AuditLogEntry.objects.first().actor_id is None
    assert AuditLogEntry.objects.last().actor_id is None


@pytest.mark.django_db
def test_no_op_message(region_to_control_consumer_worker, user):
    assert dataclasses.asdict(RegionToControlMessage()) == dict(
        user_ip_event=None, audit_log_event=None
    )

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


@pytest.mark.django_db
@pytest.mark.parametrize(
    "audit_log_event",
    [
        lambda user, organization: (
            {
                "organization_id": organization.id,
                "actor_user_id": user.id,
                "event_id": 1,
                "time_of_creation": "2000-01-01T00:00:00.000000Z",
                "actor_label": "Zach",
            }
        ),
        lambda user, organization: (
            {
                "organization_id": organization.id,
                "event_id": 1,
                "time_of_creation": "2000-01-01T00:00:00.000000Z",
                "actor_label": "Zach",
                "actor_user_id": user.id,
                "target_object_id": 150,
                "ip_address": "127.0.0.1",
                "data": {},
            }
        ),
    ],
)
def test_audit_log_event_regression(
    region_to_control_consumer_worker, user, audit_log_event, organization
):
    region_to_control_consumer_worker.flush_batch(
        [
            RegionToControlMessage.from_payload(
                dict(audit_log_event=audit_log_event(user, organization))
            )
        ]
    )

    assert AuditLogEntry.objects.count() == 1
