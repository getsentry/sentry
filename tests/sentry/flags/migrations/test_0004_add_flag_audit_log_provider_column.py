from datetime import datetime, timezone

from sentry.testutils.cases import TestMigrations


class AddFlagAuditLogProviderColumnTest(TestMigrations):
    migrate_from = "0003_allow_null_created_by"
    migrate_to = "0004_add_flag_audit_log_provider_column"
    app = "flags"

    def setup_before_migration(self, apps):
        FlagAuditLogModel = apps.get_model("flags", "FlagAuditLogModel")
        self.created_at = datetime.now(timezone.utc)
        self.audit_log = FlagAuditLogModel.objects.create(
            action=0,
            created_at=self.created_at,
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={"commit_sha": "123"},
        )

    def test(self):
        self.audit_log.refresh_from_db()
        assert self.audit_log.provider is None

        assert self.audit_log.action == 0
        assert self.audit_log.created_at == self.created_at
        assert self.audit_log.created_by == "a@b.com"
        assert self.audit_log.created_by_type == 0
        assert self.audit_log.flag == "hello"
        assert self.audit_log.organization_id == self.organization.id
        assert self.audit_log.tags == {"commit_sha": "123"}
