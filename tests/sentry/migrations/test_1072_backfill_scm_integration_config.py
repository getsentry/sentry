import importlib

from django.apps import apps as global_apps

from sentry.constants import ObjectStatus
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.options.organization_option import OrganizationOption
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode

migration = importlib.import_module("sentry.migrations.1072_backfill_scm_integration_config")


class BackfillScmIntegrationConfigTest(TestCase):
    def test_backfill(self) -> None:
        github = self.create_integration(
            organization=self.organization, provider="github", external_id="gh-1"
        )
        gitlab = self.create_integration(
            organization=self.organization, provider="gitlab", external_id="gl-1"
        )
        with assume_test_silo_mode(SiloMode.CELL):
            OrganizationOption.objects.set_value(
                organization=self.organization, key="sentry:github_pr_bot", value=True
            )
            OrganizationOption.objects.set_value(
                organization=self.organization, key="sentry:github_nudge_invite", value=False
            )
            OrganizationOption.objects.set_value(
                organization=self.organization, key="sentry:gitlab_pr_bot", value=True
            )

        other_org = self.create_organization()
        preset_github = self.create_integration(
            organization=other_org,
            provider="github",
            external_id="gh-preset",
            oi_params={"config": {"pr_comments": False, "other_key": "kept"}},
        )
        with assume_test_silo_mode(SiloMode.CELL):
            OrganizationOption.objects.set_value(
                organization=other_org, key="sentry:github_pr_bot", value=True
            )
            OrganizationOption.objects.set_value(
                organization=other_org, key="sentry:github_nudge_invite", value=True
            )

        no_option_org = self.create_organization()
        untouched_github = self.create_integration(
            organization=no_option_org, provider="github", external_id="gh-nooptions"
        )

        disabled_org = self.create_organization()
        disabled_github = self.create_integration(
            organization=disabled_org,
            provider="github",
            external_id="gh-disabled",
            oi_params={"status": ObjectStatus.DISABLED},
        )
        with assume_test_silo_mode(SiloMode.CELL):
            OrganizationOption.objects.set_value(
                organization=disabled_org, key="sentry:github_pr_bot", value=True
            )

        non_scm_org = self.create_organization()
        slack = self.create_integration(
            organization=non_scm_org, provider="slack", external_id="slack-1"
        )

        with assume_test_silo_mode(SiloMode.MONOLITH):
            migration.backfill_scm_integration_config(global_apps, None)

        with assume_test_silo_mode(SiloMode.CONTROL):
            github_oi = OrganizationIntegration.objects.get(
                integration_id=github.id, organization_id=self.organization.id
            )
            gitlab_oi = OrganizationIntegration.objects.get(
                integration_id=gitlab.id, organization_id=self.organization.id
            )
            preset_oi = OrganizationIntegration.objects.get(
                integration_id=preset_github.id, organization_id=other_org.id
            )
            untouched_oi = OrganizationIntegration.objects.get(
                integration_id=untouched_github.id, organization_id=no_option_org.id
            )
            disabled_oi = OrganizationIntegration.objects.get(
                integration_id=disabled_github.id, organization_id=disabled_org.id
            )
            slack_oi = OrganizationIntegration.objects.get(
                integration_id=slack.id, organization_id=non_scm_org.id
            )

        assert github_oi.config == {"pr_comments": True, "nudge_invite": False}
        assert gitlab_oi.config == {"pr_comments": True}
        assert preset_oi.config["pr_comments"] is False
        assert preset_oi.config["nudge_invite"] is True
        assert preset_oi.config["other_key"] == "kept"
        assert untouched_oi.config == {}
        assert disabled_oi.config == {}
        assert slack_oi.config == {}
