from sentry.constants import ObjectStatus
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import assume_test_silo_mode


class BackfillScmIntegrationConfigTest(TestMigrations):
    migrate_from = "1071_add_broadcast_sync_locked"
    migrate_to = "1072_backfill_scm_integration_config"

    def setup_before_migration(self, apps):
        Integration = apps.get_model("sentry", "Integration")
        OrganizationIntegration = apps.get_model("sentry", "OrganizationIntegration")
        OrganizationOption = apps.get_model("sentry", "OrganizationOption")

        with assume_test_silo_mode(SiloMode.MONOLITH):
            true_org = self.create_organization()
            gh = Integration.objects.create(provider="github", external_id="gh-true", name="gh-t")
            gl = Integration.objects.create(provider="gitlab", external_id="gl-true", name="gl-t")
            self.true_gh_oi = OrganizationIntegration.objects.create(
                organization_id=true_org.id,
                integration_id=gh.id,
                status=ObjectStatus.ACTIVE,
                config={},
            )
            self.true_gl_oi = OrganizationIntegration.objects.create(
                organization_id=true_org.id,
                integration_id=gl.id,
                status=ObjectStatus.ACTIVE,
                config={},
            )
            OrganizationOption.objects.create(
                organization_id=true_org.id, key="sentry:github_pr_bot", value=True
            )
            OrganizationOption.objects.create(
                organization_id=true_org.id, key="sentry:github_nudge_invite", value=True
            )
            OrganizationOption.objects.create(
                organization_id=true_org.id, key="sentry:gitlab_pr_bot", value=True
            )

            # Org with explicit false value — should NOT be backfilled (new
            # read path treats missing key as false).
            false_org = self.create_organization()
            false_gh = Integration.objects.create(
                provider="github", external_id="gh-false", name="gh-f"
            )
            self.false_gh_oi = OrganizationIntegration.objects.create(
                organization_id=false_org.id,
                integration_id=false_gh.id,
                status=ObjectStatus.ACTIVE,
                config={},
            )
            OrganizationOption.objects.create(
                organization_id=false_org.id, key="sentry:github_pr_bot", value=False
            )

            # Mixed org — github_pr_bot=true, github_nudge_invite=false. Only
            # the true key should populate; the false one stays absent.
            mixed_org = self.create_organization()
            mixed_gh = Integration.objects.create(
                provider="github", external_id="gh-mixed", name="gh-m"
            )
            self.mixed_gh_oi = OrganizationIntegration.objects.create(
                organization_id=mixed_org.id,
                integration_id=mixed_gh.id,
                status=ObjectStatus.ACTIVE,
                config={},
            )
            OrganizationOption.objects.create(
                organization_id=mixed_org.id, key="sentry:github_pr_bot", value=True
            )
            OrganizationOption.objects.create(
                organization_id=mixed_org.id, key="sentry:github_nudge_invite", value=False
            )

            # OI with a preset config — existing keys are not overwritten;
            # unrelated keys are preserved.
            preset_org = self.create_organization()
            preset_gh = Integration.objects.create(
                provider="github", external_id="gh-preset", name="gh-p"
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

            # Disabled OI — skipped.
            disabled_org = self.create_organization()
            disabled_gh = Integration.objects.create(
                provider="github", external_id="gh-disabled", name="gh-d"
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

    def test(self) -> None:
        from sentry.integrations.models.organization_integration import OrganizationIntegration

        with assume_test_silo_mode(SiloMode.CONTROL):
            true_gh = OrganizationIntegration.objects.get(id=self.true_gh_oi.id).config
            true_gl = OrganizationIntegration.objects.get(id=self.true_gl_oi.id).config
            false_gh = OrganizationIntegration.objects.get(id=self.false_gh_oi.id).config
            mixed_gh = OrganizationIntegration.objects.get(id=self.mixed_gh_oi.id).config
            preset = OrganizationIntegration.objects.get(id=self.preset_oi.id).config
            disabled = OrganizationIntegration.objects.get(id=self.disabled_oi.id).config

        assert true_gh == {"pr_comments": True, "nudge_invite": True}
        assert true_gl == {"pr_comments": True}
        assert false_gh == {}
        assert mixed_gh == {"pr_comments": True}
        assert preset["pr_comments"] is False
        assert preset["nudge_invite"] is True
        assert preset["other_key"] == "kept"
        assert disabled == {}
