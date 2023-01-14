from sentry.services.hybrid_cloud.audit_log import AuditLogEvent, AuditLogService, UserIpEvent


class DatabaseBackedAuditLogService(AuditLogService):
    def close(self) -> None:
        pass

    def record_audit_log(self, *, event: AuditLogEvent) -> None:
        pass

    def record_user_ip(self, *, event: UserIpEvent) -> None:
        pass
