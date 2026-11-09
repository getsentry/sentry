from io import StringIO
from unittest import mock

import pytest
from django.core.management import CommandError, call_command
from django.test import override_settings

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
        with mock.patch.dict(
            "os.environ", {"FAKE_SLACK_PUBLIC_URL": "https://8099--box.example.com"}
        ):
            box_output = self.run_command("--org", self.organization.slug)

        integration = Integration.objects.get(provider="slack")
        assert integration.external_id == "T0FAKE"
        assert integration.metadata["access_token"] == "xoxb-fake-slack"
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()
        assert f"Connected {self.organization.slug}" in output
        assert "see them at http://localhost:8099 " in output
        assert "see them at https://8099--box.example.com " in box_output

        self.create_organization()
        with pytest.raises(CommandError, match="--org"):
            self.run_command()
        with pytest.raises(CommandError, match="nope"):
            self.run_command("--org", "nope")
