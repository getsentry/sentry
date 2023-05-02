from sentry.testutils.cases import TestMigrations


class ResolveMismatchedTeamSlugsForScimTest(TestMigrations):
    migrate_from = "0433_set_monitor_status_to_object_status_only"
    migrate_to = "0434_resolve_mismatched_team_slugs_for_scim"

    def setup_before_migration(self, apps):
        self.idp_slug_matched = self.create_team(organization=self.organization, name="Foo Bar")
        self.idp_slug_matched.idp_provisioned = True
        self.idp_slug_matched.save()

        self.idp_slug_mismatched = self.create_team(
            organization=self.organization, name="Foo Bar 2"
        )
        self.idp_slug_mismatched.slug = "not-a-match"
        self.idp_slug_mismatched.idp_provisioned = True
        self.idp_slug_mismatched.save()

        self.not_idp_slug_matched = self.create_team(
            organization=self.organization, name="Foo Bar 3"
        )
        self.not_idp_slug_matched.idp_provisioned = False
        self.not_idp_slug_matched.save()

        self.not_idp_slug_mismatched = self.create_team(
            organization=self.organization, name="Foo Bar 4"
        )
        self.not_idp_slug_mismatched.slug = "not-another-match"
        self.not_idp_slug_mismatched.idp_provisioned = False
        self.not_idp_slug_mismatched.save()

    def test(self):
        self.idp_slug_matched.refresh_from_db()
        assert self.idp_slug_matched.name == "Foo Bar"
        assert self.idp_slug_matched.slug == "foo-bar"

        self.idp_slug_mismatched.refresh_from_db()
        assert self.idp_slug_mismatched.name == "Foo Bar 2"
        assert self.idp_slug_mismatched.slug == "foo-bar-2"

        self.not_idp_slug_matched.refresh_from_db()
        assert self.not_idp_slug_matched.name == "Foo Bar 3"
        assert self.not_idp_slug_matched.slug == "foo-bar-3"

        self.not_idp_slug_mismatched.refresh_from_db()
        assert self.not_idp_slug_mismatched.name == "Foo Bar 4"
        assert self.not_idp_slug_mismatched.slug == "not-another-match"
