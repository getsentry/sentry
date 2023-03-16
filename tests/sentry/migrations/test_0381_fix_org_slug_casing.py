from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations


class TestOrgSlugMigration(TestMigrations):
    migrate_from = "0380_backfill_monitor_env_initial"
    migrate_to = "0381_fix_org_slug_casing"

    def setup_before_migration(self, apps):
        self.ok_org = self.create_organization(slug="good-slug")
        self.rename_org = self.create_organization(slug="badslug")

        self.has_lower = self.create_organization(slug="taken")
        self.is_dupe = self.create_organization(slug="taken-dupe")

        # Organization.save() corrects our bad slugs, so
        # we need to sneak by django and coerce bad states
        Organization.objects.filter(id=self.rename_org.id).update(slug="bAdSluG")
        Organization.objects.filter(id=self.is_dupe.id).update(slug="TakeN")

    def test(self):
        self.ok_org.refresh_from_db()
        self.rename_org.refresh_from_db()

        assert self.ok_org.slug == "good-slug"
        assert self.rename_org.slug == "badslug"

        self.has_lower.refresh_from_db()
        self.is_dupe.refresh_from_db()

        assert self.has_lower.slug == "taken"
        assert self.is_dupe.slug.startswith("taken-")
        assert self.is_dupe.slug != "taken"
