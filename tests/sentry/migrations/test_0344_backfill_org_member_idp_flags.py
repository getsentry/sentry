from sentry.models import OrganizationMember
from sentry.testutils.cases import TestMigrations


class TestDefaultFlag(TestMigrations):
    migrate_from = "0343_drop_savedsearch_userdefault_fk_constraints_and_remove_state"
    migrate_to = "0344_add_idp_flags"

    def setup_before_migration(self, apps):
        self.new_user = self.create_user("foo@example.com")
        self.orgmember = OrganizationMember.objects.create(
            organization=self.organization, user=self.new_user, role="member"
        )
        assert "idp:provisioned" not in self.orgmember.flags
        assert "idp:role-restricted" not in self.orgmember.flags

    def test(self):
        after_migration_orgmember = OrganizationMember.objects.get(id=self.orgmember.id)
        assert not after_migration_orgmember.flags["idp:provisioned"]
        assert not after_migration_orgmember.flags["idp:role-restricted"]
