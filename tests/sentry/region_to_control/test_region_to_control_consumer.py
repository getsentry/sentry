import dataclasses
import datetime
from typing import Any, Mapping
from unittest.mock import Mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic

from sentry.models import ApiKey, AuditLogEntry, UserIP
from sentry.region_to_control.consumer import ProcessRegionToControlMessage
from sentry.region_to_control.messages import RegionToControlMessage
from sentry.testutils.factories import Factories
from sentry.utils import json


def make_message(data: Mapping[str, Any]) -> Message[KafkaPayload]:
    return Message(
        Partition(Topic("region-to-control"), 0),
        0,
        KafkaPayload(None, json.dumps(data).encode("utf-8"), []),
        datetime.datetime.now(),
    )


@pytest.fixture
def region_to_control_strategy():
    next_step = Mock()
    return ProcessRegionToControlMessage(next_step)


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
def test_user_ip_event_with_deleted_user(region_to_control_strategy, user):
    message = make_message(
        {
            "user_ip_event": {
                "user_id": user.id,
                "ip_address": "127.0.0.1",
                "last_seen": datetime.datetime.now(),
            }
        }
    )
    region_to_control_strategy.submit(message)

    assert UserIP.objects.count() == 1

    user.delete()

    region_to_control_strategy.submit(message)

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
def test_region_to_control_with_deleted_user(region_to_control_strategy, user, organization):
    assert AuditLogEntry.objects.count() == 0

    message = make_message(
        {
            "audit_log_event": {
                "actor_user_id": user.id,
                "ip_address": "127.0.0.1",
                "organization_id": organization.id,
                "event_id": 0,
                "time_of_creation": "2000-01-01T00:00:00.000000Z",
                "actor_label": "Zach",
            }
        }
    )

    region_to_control_strategy.submit(message)

    assert AuditLogEntry.objects.count() == 1
    assert AuditLogEntry.objects.first().actor_id is not None

    # This does not cascade, but sets null
    user.delete()
    assert AuditLogEntry.objects.count() == 1

    region_to_control_strategy.submit(message)

    assert AuditLogEntry.objects.count() == 2

    assert AuditLogEntry.objects.first().actor_id is None
    assert AuditLogEntry.objects.last().actor_id is None


@pytest.mark.django_db
def test_no_op_message(region_to_control_strategy, user):
    assert dataclasses.asdict(RegionToControlMessage()) == dict(
        user_ip_event=None, audit_log_event=None
    )

    message = make_message({})

    region_to_control_strategy.submit(message)

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
def test_user_ip_event_regression(region_to_control_strategy, user, user_ip_event):
    message = make_message({"user_ip_event": user_ip_event(user)})

    region_to_control_strategy.submit(message)

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
    region_to_control_strategy, user, audit_log_event, organization
):
    message = make_message({"audit_log_event": audit_log_event(user, organization)})
    region_to_control_strategy.submit(message)

    assert AuditLogEntry.objects.count() == 1
