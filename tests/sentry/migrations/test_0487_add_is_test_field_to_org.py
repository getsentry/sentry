from sentry.testutils.cases import TestMigrations


class AddIsTestFieldToOrgMigrationTest(TestMigrations):
    migrate_from = "0486_integer_pr_comment_issue_list"
    migrate_to = "0487_add_is_test_field_to_org"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        self.organization_with_defalult = Organization.objects.create(slug="my_organization")

    def test(self):
        # Test state after migration
        self.organization_with_defalult.refresh_from_db()
        assert self.organization_with_defalult.slug == "my_organization"
        assert self.organization_with_defalult.is_test is False
