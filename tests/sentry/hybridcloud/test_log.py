from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.outbox import OutboxScope, RegionOutbox
from sentry.models.userip import UserIP
from sentry.services.hybrid_cloud.log import AuditLogEvent, UserIpEvent, log_service
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@django_db_all
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

    with assume_test_silo_mode(SiloMode.REGION):
        RegionOutbox(
            shard_scope=OutboxScope.AUDIT_LOG_SCOPE, shard_identifier=organization.id
        ).drain_shard()

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert AuditLogEntry.objects.count() == 1


@django_db_all
@all_silo_test
def test_user_ip_event():
    user = Factories.create_user()

    log_service.record_user_ip(
        event=UserIpEvent(
            user_id=user.id,
            ip_address="127.0.0.1",
        )
    )

    with assume_test_silo_mode(SiloMode.REGION):
        RegionOutbox(shard_scope=OutboxScope.USER_IP_SCOPE, shard_identifier=user.id).drain_shard()

    log_service.record_user_ip(
        event=UserIpEvent(
            user_id=user.id,
            ip_address="1.0.0.5",
        )
    )

    with assume_test_silo_mode(SiloMode.REGION):
        RegionOutbox(shard_scope=OutboxScope.USER_IP_SCOPE, shard_identifier=user.id).drain_shard()

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert UserIP.objects.last().ip_address == "1.0.0.5"
        assert UserIP.objects.count() == 2
