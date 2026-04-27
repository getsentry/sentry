from sentry.constants import ObjectStatus
from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import control_silo_test


@control_silo_test
class BackfillScmIntegrationConfigTest(TestMigrations):
    migrate_from = "1071_add_broadcast_sync_locked"
    migrate_to = "1072_backfill_scm_integration_config"
    connection = "control"

    def setup_before_migration(self, apps):
        Integration = apps.get_model("sentry", "Integration")
        OrganizationIntegration = apps.get_model("sentry", "OrganizationIntegration")
        OrganizationOption = apps.get_model("sentry", "OrganizationOption")

        org = self.create_organization()
        gh = Integration.objects.create(provider="github", external_id="gh-1", name="gh")
        gl = Integration.objects.create(provider="gitlab", external_id="gl-1", name="gl")
        self.gh_oi = OrganizationIntegration.objects.create(
            organization_id=org.id, integration_id=gh.id, status=ObjectStatus.ACTIVE, config={}
        )
        self.gl_oi = OrganizationIntegration.objects.create(
            organization_id=org.id, integration_id=gl.id, status=ObjectStatus.ACTIVE, config={}
        )
        OrganizationOption.objects.create(
            organization_id=org.id, key="sentry:github_pr_bot", value=True
        )
        OrganizationOption.objects.create(
            organization_id=org.id, key="sentry:github_nudge_invite", value=False
        )
        OrganizationOption.objects.create(
            organization_id=org.id, key="sentry:gitlab_pr_bot", value=True
        )

        preset_org = self.create_organization()
        preset_gh = Integration.objects.create(
            provider="github", external_id="gh-preset", name="preset"
        )
        self.preset_oi = OrganizationIntegration.objects.create(
            organization_id=preset_org.id,
            integration_id=preset_gh.id,
            status=ObjectStatus.ACTIVE,
            config={"pr_comments": False, "other_key": "kept"},
        )
        OrganizationOption.objects.create(
            organization_id=preset_org.id, key="sentry:github_pr_bot", value=True
        )
        OrganizationOption.objects.create(
            organization_id=preset_org.id, key="sentry:github_nudge_invite", value=True
        )

        no_option_org = self.create_organization()
        no_option_gh = Integration.objects.create(
            provider="github", external_id="gh-nooptions", name="no-opt"
        )
        self.untouched_oi = OrganizationIntegration.objects.create(
            organization_id=no_option_org.id,
            integration_id=no_option_gh.id,
            status=ObjectStatus.ACTIVE,
            config={},
        )

        disabled_org = self.create_organization()
        disabled_gh = Integration.objects.create(
            provider="github", external_id="gh-disabled", name="disabled"
        )
        self.disabled_oi = OrganizationIntegration.objects.create(
            organization_id=disabled_org.id,
            integration_id=disabled_gh.id,
            status=ObjectStatus.DISABLED,
            config={},
        )
        OrganizationOption.objects.create(
            organization_id=disabled_org.id, key="sentry:github_pr_bot", value=True
        )

        non_scm_org = self.create_organization()
        slack = Integration.objects.create(provider="slack", external_id="slack-1", name="slack")
        self.slack_oi = OrganizationIntegration.objects.create(
            organization_id=non_scm_org.id,
            integration_id=slack.id,
            status=ObjectStatus.ACTIVE,
            config={},
        )

    def test(self) -> None:
        from sentry.integrations.models.organization_integration import OrganizationIntegration

        assert OrganizationIntegration.objects.get(id=self.gh_oi.id).config == {
            "pr_comments": True,
            "nudge_invite": False,
        }
        assert OrganizationIntegration.objects.get(id=self.gl_oi.id).config == {"pr_comments": True}

        preset = OrganizationIntegration.objects.get(id=self.preset_oi.id).config
        assert preset["pr_comments"] is False
        assert preset["nudge_invite"] is True
        assert preset["other_key"] == "kept"

        assert OrganizationIntegration.objects.get(id=self.untouched_oi.id).config == {}
        assert OrganizationIntegration.objects.get(id=self.disabled_oi.id).config == {}
        assert OrganizationIntegration.objects.get(id=self.slack_oi.id).config == {}
