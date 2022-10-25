import datetime
import random

import pytest
from django.conf import settings
from django.test import override_settings

from sentry.models import AuditLogEntry, UserIP
from sentry.region_to_control.consumer import get_region_to_control_consumer
from sentry.region_to_control.messages import UserIpEvent
from sentry.region_to_control.producer import region_to_control_message_service, user_ip_service
from sentry.services.hybrid_cloud import use_real_service
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
from sentry.utils.audit import create_audit_entry_from_user
from sentry.utils.batching_kafka_consumer import create_topics

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100


@pytest.fixture
def user():
    return Factories.create_user("admin@localhost")


@pytest.fixture
def organization(user):
    return Factories.create_organization("TestOrg", owner=user)


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
            group_id=random_group_id, auto_offset_reset="earliest"
        )

        consumer._run_once()

        return consumer


@pytest.mark.django_db(transaction=True)
def test_region_to_control_user_ip(
    kafka_producer,
    kafka_admin,
    region_to_control_consumer,
    user,
):
    with use_real_service(region_to_control_message_service, SiloMode.REGION):
        with override_settings(SILO_MODE=SiloMode.REGION):
            user_ip_service.produce_user_ip(
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
def test_region_to_control_user_audit_log(
    kafka_producer,
    kafka_admin,
    user,
    organization,
    region_to_control_consumer,
):

    # In the case of user audit logs, they should be produced with a synchronous confirmation to ensure durable write.
    # If this test is 'flakey' wrt message production -> a single _run_once loop at any time, it means that the
    # durable write logic isn't working!  That's a real bug.  Unfortunately, there isn't a super great way to fake
    # lag between the confluent client and the kafka queue to make a reliable test of synchronous behavior.
    with use_real_service(region_to_control_message_service, SiloMode.REGION):
        with override_settings(SILO_MODE=SiloMode.REGION):
            create_audit_entry_from_user(
                user,
                organization_id=organization.id,
                target_object=15,
                data=dict(custom=15),
                event=19,
                ip_address="9.9.9.9",
            )

    entry = AuditLogEntry.objects.last()
    assert entry is None

    for i in range(MAX_POLL_ITERATIONS):
        entry = AuditLogEntry.objects.last()
        if entry:
            break
        region_to_control_consumer._run_once()
    else:
        raise AssertionError(
            "region_to_control_consumer never successfully processed audit log entry"
        )

    assert entry.actor.id == user.id
    assert entry.ip_address == "9.9.9.9"
    assert entry.organization.id == organization.id
    assert entry.target_object == 15
    assert entry.data == dict(custom=15)
    assert entry.event == 19
