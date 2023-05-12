import sentry_sdk
from django.db import IntegrityError

from sentry.models import AuditLogEntry, OutboxCategory, OutboxScope, RegionOutbox, UserIP
from sentry.services.hybrid_cloud.log import AuditLogEvent, LogService, UserIpEvent
from sentry.utils import metrics


class DatabaseBackedLogService(LogService):
    def close(self) -> None:
        pass

    def record_audit_log(self, *, event: AuditLogEvent) -> None:
        entry = AuditLogEntry.from_event(event)
        try:
            entry.save()
        except IntegrityError as e:
            error_message = str(e)
            # TODO: Once we break the organization id, it will be "ok" to save audit logs with old organization
            # identifiers and simply allow the reconciliation with tombstones to delete them.
            if '"sentry_organization"' in error_message:
                metrics.incr("hybrid_cloud.audit_log.audit_log_entry.stale_event")
                with sentry_sdk.push_scope() as scope:
                    scope.level = "warning"
                    scope.set_tag("organization_id", event.organization_id)
                    scope.set_tag("event_id", event.event_id)
                    sentry_sdk.capture_message(
                        "Stale organization in audit log entry detected, org may have been deleted."
                    )
                return
            if '"auth_user"' in error_message:
                # It is possible that a user existed at the time of serialization but was deleted by the time of consumption
                # in which case we follow the database's SET NULL on delete handling.
                entry.actor_user_id = None
                return self.record_audit_log(event=event)
            else:
                raise

    def record_user_ip(self, *, event: UserIpEvent) -> None:
        updated, created = UserIP.objects.create_or_update(
            user_id=event.user_id,
            ip_address=event.ip_address,
            values=dict(
                last_seen=event.last_seen,
                country_code=event.country_code,
                region_code=event.region_code,
            ),
        )
        if not created and not updated:
            # This happens when there is an integrity error adding the UserIP -- such as when user is deleted,
            # or the ip address does not match the db validation.  This is expected and not an error condition
            # in low quantities.
            # TODO: Break the foreign key and simply remove this code path.
            metrics.incr("hybrid_cloud.audit_log.user_ip_event.stale_event")


class OutboxBackedLogService(LogService):
    def close(self) -> None:
        pass

    def record_audit_log(self, *, event: AuditLogEvent) -> None:
        RegionOutbox(
            shard_scope=OutboxScope.AUDIT_LOG_SCOPE,
            shard_identifier=event.organization_id,
            category=OutboxCategory.AUDIT_LOG_EVENT,
            object_identifier=RegionOutbox.next_object_identifier(),
            payload=event.__dict__,
        ).save()

    def record_user_ip(self, *, event: UserIpEvent) -> None:
        RegionOutbox(
            shard_scope=OutboxScope.USER_IP_SCOPE,
            shard_identifier=event.user_id,
            category=OutboxCategory.USER_IP_EVENT,
            object_identifier=event.user_id,
            payload=event.__dict__,
        ).save()
