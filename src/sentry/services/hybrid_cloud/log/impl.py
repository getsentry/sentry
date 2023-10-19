from __future__ import annotations

import datetime

from django.db import IntegrityError, router, transaction

from sentry.db.postgres.transactions import enforce_constraints
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.outbox import OutboxCategory, OutboxScope, RegionOutbox
from sentry.models.user import User
from sentry.models.userip import UserIP
from sentry.services.hybrid_cloud.log import AuditLogEvent, LogService, UserIpEvent
from sentry.silo import unguarded_write


class DatabaseBackedLogService(LogService):
    def record_audit_log(self, *, event: AuditLogEvent) -> None:
        entry = AuditLogEntry.from_event(event)
        try:
            with enforce_constraints(transaction.atomic(router.db_for_write(AuditLogEntry))):
                entry.save()
        except IntegrityError as e:
            error_message = str(e)
            if '"auth_user"' in error_message:
                # It is possible that a user existed at the time of serialization but was deleted by the time of consumption
                # in which case we follow the database's SET NULL on delete handling.
                event.actor_user_id = None
                return self.record_audit_log(event=event)
            else:
                raise

    def record_user_ip(self, *, event: UserIpEvent) -> None:
        UserIP.objects.create_or_update(
            user_id=event.user_id,
            ip_address=event.ip_address,
            values=dict(
                last_seen=event.last_seen,
                country_code=event.country_code,
                region_code=event.region_code,
            ),
        )
        with unguarded_write(router.db_for_write(User)):
            # It greatly simplifies testing not to be too aggressive on updating the last_active due to many
            # comparisons with serializers.
            User.objects.filter(
                id=event.user_id,
                last_active__lt=(event.last_seen - datetime.timedelta(minutes=1)),
            ).update(last_active=event.last_seen)

    def find_last_log(
        self, *, organization_id: int | None, target_object_id: int | None, event: int | None
    ) -> AuditLogEvent | None:
        last_entry: AuditLogEntry | None = AuditLogEntry.objects.filter(
            organization_id=organization_id,
            target_object=target_object_id,
            event=event,
        ).last()

        if last_entry is None:
            return None

        return last_entry.as_event()


class OutboxBackedLogService(LogService):
    def record_audit_log(self, *, event: AuditLogEvent) -> None:
        outbox = RegionOutbox(
            shard_scope=OutboxScope.AUDIT_LOG_SCOPE,
            shard_identifier=event.organization_id,
            category=OutboxCategory.AUDIT_LOG_EVENT,
            object_identifier=RegionOutbox.next_object_identifier(),
            payload=event.__dict__,
        )  # type: ignore
        outbox.save()

    def record_user_ip(self, *, event: UserIpEvent) -> None:
        outbox = RegionOutbox(
            shard_scope=OutboxScope.USER_IP_SCOPE,
            shard_identifier=event.user_id,
            category=OutboxCategory.USER_IP_EVENT,
            object_identifier=event.user_id,
            payload=event.__dict__,
        )  # type: ignore
        outbox.save()

    def find_last_log(
        self, *, organization_id: int | None, target_object_id: int | None, event: int | None
    ) -> AuditLogEvent | None:
        return None
