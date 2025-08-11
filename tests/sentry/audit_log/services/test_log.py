from unittest import mock
from unittest.mock import MagicMock

import pytest

from sentry.audit_log.services.log import AuditLogEvent, UserIpEvent, log_service
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.hybridcloud.models.outbox import OutboxFlushError, RegionOutbox
from sentry.hybridcloud.outbox.category import OutboxScope
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import (
    all_silo_test,
    assume_test_silo_mode,
    control_silo_test,
    region_silo_test,
)
from sentry.users.models.userip import UserIP


@django_db_all
@all_silo_test
def test_audit_log_event() -> None:
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
def test_audit_log_event_bad_actor_user_id() -> None:
    organization = Factories.create_organization()
    with in_test_hide_transaction_boundary():
        log_service.record_audit_log(
            event=AuditLogEvent(
                organization_id=organization.id,
                actor_user_id=99999999,
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
        log = AuditLogEntry.objects.get()
        assert log.actor_id is None


@django_db_all
@all_silo_test
def test_audit_log_event_bad_target_user_id() -> None:
    organization = Factories.create_organization()
    log_service.record_audit_log(
        event=AuditLogEvent(
            organization_id=organization.id,
            target_user_id=99999999,
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
        log = AuditLogEntry.objects.get()
        assert log.actor_id is None
        assert log.target_user_id is None


@django_db_all
@all_silo_test
def test_user_ip_event() -> None:
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
        assert UserIP.objects.get(ip_address="1.0.0.5")
        assert UserIP.objects.count() == 2


@django_db_all
@control_silo_test(include_monolith_run=True)
def test_skip_list_when_invalid_data_passed() -> None:
    with pytest.raises(AssertionError):
        log_service.record_audit_log(event=AuditLogEvent(event_id=100))

    with override_options({"hybrid_cloud.audit_log_event_id_invalid_pass_list": [100]}):
        log_service.record_audit_log(event=AuditLogEvent(event_id=100))


@django_db_all
@control_silo_test(include_monolith_run=True)
@mock.patch("sentry.audit_log.services.log.impl.logger")
def test_invalid_skip_list(mock_logger: MagicMock) -> None:
    with override_options({"hybrid_cloud.audit_log_event_id_invalid_pass_list": [100, "foo"]}):
        with pytest.raises(AssertionError):
            log_service.record_audit_log(event=AuditLogEvent(event_id=100))

    mock_logger.error.assert_called_once()
    mock_logger.error.assert_called_with(
        "audit_log.invalid_audit_log_pass_list",
        extra={"pass_list": [100, "foo"]},
    )
    mock_logger.reset_mock()

    with override_options({"hybrid_cloud.audit_log_event_id_invalid_pass_list": None}):
        with pytest.raises(AssertionError):
            log_service.record_audit_log(event=AuditLogEvent(event_id=100))

    mock_logger.error.assert_called_once()
    mock_logger.error.assert_called_with(
        "audit_log.invalid_audit_log_pass_list",
        extra={"pass_list": None},
    )


@django_db_all
@region_silo_test
def test_skip_list_rpc_call_with_invalid_data_passed() -> None:
    log_service.record_audit_log(event=AuditLogEvent(event_id=100))

    with pytest.raises(OutboxFlushError):
        RegionOutbox(shard_scope=OutboxScope.AUDIT_LOG_SCOPE, shard_identifier=-1).drain_shard()

    with override_options({"hybrid_cloud.audit_log_event_id_invalid_pass_list": [100]}):
        RegionOutbox(shard_scope=OutboxScope.AUDIT_LOG_SCOPE, shard_identifier=-1).drain_shard()
