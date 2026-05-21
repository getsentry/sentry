import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip(reason="fails because projecttemplate was removed")
class PurgeScmLegacyOrgOptionsTest(TestMigrations):
    migrate_from = "1078_drop_querysubscription_time_window"
    migrate_to = "1079_purge_scm_legacy_org_options"

    def setup_before_migration(self, apps):
        OrganizationOption = apps.get_model("sentry", "OrganizationOption")

        org = self.create_organization()
        other_org = self.create_organization()

        self.legacy_gh_pr = OrganizationOption.objects.create(
            organization_id=org.id, key="sentry:github_pr_bot", value=True
        )
        self.legacy_gh_nudge = OrganizationOption.objects.create(
            organization_id=org.id, key="sentry:github_nudge_invite", value=True
        )
        self.legacy_gl_pr = OrganizationOption.objects.create(
            organization_id=other_org.id, key="sentry:gitlab_pr_bot", value=False
        )

        self.kept_unrelated = OrganizationOption.objects.create(
            organization_id=org.id, key="sentry:require_scrub_data", value=True
        )
        self.kept_other_org = OrganizationOption.objects.create(
            organization_id=other_org.id, key="sentry:some_other_toggle", value=True
        )

    def test(self) -> None:
        from sentry.models.options.organization_option import OrganizationOption

        assert not OrganizationOption.objects.filter(id=self.legacy_gh_pr.id).exists()
        assert not OrganizationOption.objects.filter(id=self.legacy_gh_nudge.id).exists()
        assert not OrganizationOption.objects.filter(id=self.legacy_gl_pr.id).exists()

        assert OrganizationOption.objects.filter(id=self.kept_unrelated.id).exists()
        assert OrganizationOption.objects.filter(id=self.kept_other_org.id).exists()
