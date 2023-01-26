import pytest

from sentry.models import AuditLogEntry, OutboxScope, RegionOutbox, UserIP
from sentry.services.hybrid_cloud.log import AuditLogEvent, UserIpEvent, log_service
from sentry.testutils.factories import Factories
from sentry.testutils.silo import all_silo_test, exempt_from_silo_limits


@pytest.mark.django_db
@all_silo_test
def test_audit_log_event():
    user = Factories.create_user()
    organization = Factories.create_organization()
    log_service.record_audit_log(
        event=AuditLogEvent(
            organization_id=organization.id,
            actor_user_id=user.id,
            event_id=1,
            ip_address="127.0.0.1",
            target_object_id=123,
            data=dict(abcdef=123),
        )
    )

    with exempt_from_silo_limits():
        RegionOutbox.for_shard(
            shard_scope=OutboxScope.AUDIT_LOG_SCOPE, shard_identifier=organization.id
        ).drain_shard()

    assert AuditLogEntry.objects.count() == 1


@pytest.mark.django_db
@all_silo_test
def test_user_ip_event():
    user = Factories.create_user()

    log_service.record_user_ip(
        event=UserIpEvent(
            user_id=user.id,
            ip_address="127.0.0.1",
        )
    )

    log_service.record_user_ip(
        event=UserIpEvent(
            user_id=user.id,
            ip_address="1.0.0.5",
        )
    )

    with exempt_from_silo_limits():
        RegionOutbox.for_shard(
            shard_scope=OutboxScope.USER_IP_SCOPE, shard_identifier=user.id
        ).drain_shard()

    assert UserIP.objects.count() == 2
    assert UserIP.objects.last().ip_address == "1.0.0.5"
