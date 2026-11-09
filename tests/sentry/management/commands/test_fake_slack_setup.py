from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from django.test import override_settings

from fixtures.integrations.fake_slack.server import TEAM
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class FakeSlackSetupTest(TestCase):
    def run_command(self, *args: str) -> str:
        out = StringIO()
        call_command("fake_slack_setup", *args, stdout=out, stderr=StringIO())
        return out.getvalue()

    def test_requires_fake_slack(self) -> None:
        with pytest.raises(CommandError, match="SENTRY_USE_FAKE_SLACK"):
            self.run_command("--org", self.organization.slug)
        assert not Integration.objects.filter(provider="slack").exists()

    @override_settings(SENTRY_USE_FAKE_SLACK=True)
    def test_connects_organization(self) -> None:
        output = self.run_command("--org", self.organization.slug)
        self.run_command("--org", self.organization.slug)

        integration = Integration.objects.get(provider="slack")
        assert integration.external_id == TEAM["id"]
        assert integration.name == TEAM["name"]
        assert integration.metadata["domain_name"] == f"{TEAM['domain']}.slack.com"
        assert integration.metadata["access_token"] == "xoxb-fake-slack"
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()
        assert f"Connected {self.organization.slug}" in output
        assert "on port 8099 (http://localhost:8099 locally)" in output

        self.create_organization()
        with pytest.raises(CommandError, match="--org"):
            self.run_command()
        with pytest.raises(CommandError, match="nope"):
            self.run_command("--org", "nope")
