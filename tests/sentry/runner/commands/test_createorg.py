from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.runner.commands.createorg import createorg
from sentry.testutils.cases import CliTestCase


class CreateOrgTest(CliTestCase):
    command = createorg

    def test_basic_create(self) -> None:
        rv = self.invoke("--name=Test Org", "--slug=test-org", "--owner-email=owner@example.com")
        assert rv.exit_code == 0, rv.output
        assert "test-org" in rv.output

        org = Organization.objects.get(slug="test-org")
        assert org.name == "Test Org"
        assert OrganizationMember.objects.filter(
            organization=org, email="owner@example.com"
        ).exists()
        assert Team.objects.filter(organization=org).exists()

    def test_slug_defaults_to_name(self) -> None:
        rv = self.invoke("--name=My Organization", "--owner-email=owner@example.com")
        assert rv.exit_code == 0, rv.output

        assert Organization.objects.filter(slug="my-organization").exists()

    def test_no_default_team(self) -> None:
        rv = self.invoke(
            "--name=No Team Org",
            "--slug=no-team-org",
            "--owner-email=owner@example.com",
            "--no-default-team",
        )
        assert rv.exit_code == 0, rv.output

        org = Organization.objects.get(slug="no-team-org")
        assert not Team.objects.filter(organization=org).exists()

    def test_missing_name(self) -> None:
        rv = self.invoke("--slug=test-org", "--owner-email=owner@example.com")
        assert rv.exit_code != 0

    def test_missing_owner_email(self) -> None:
        rv = self.invoke("--name=Test Org", "--slug=test-org")
        assert rv.exit_code != 0
