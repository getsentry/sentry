from sentry.testutils.cases import TestMigrations


class TestOrgSlugMigration(TestMigrations):
    migrate_from = "0352_add_org_role_to_team_model"
    migrate_to = "0353_fix_org_slug_casing"

    def setup_before_migration(self, apps):
        self.ok_org = self.create_organization(slug="good-slug")
        self.rename_org = self.create_organization(slug="bAdSluG")

        self.has_lower = self.create_organization(slug="taken")
        self.is_dupe = self.create_organization(slug="TakeN")

    def test(self):
        self.ok_org.refresh_from_db()
        self.rename_org.refresh_from_db()

        assert self.ok_org.slug == "good-slug"
        assert self.rename_org.slug == "badslug"

        self.has_lower.refresh_from_db()
        self.is_dupe.refresh_from_db()
        assert self.is_dupe.slug.startswith("taken")
        assert self.is_dupe.slug != "taken"
