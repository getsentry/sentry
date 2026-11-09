from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.slack.integration import SlackIntegrationProvider
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization

TEAM_ID = "T0FAKE"
TEAM_NAME = "Fake Slack"
TEAM_DOMAIN = "fake-slack"


class Command(BaseCommand):
    help = "Connects an organization to the fake Slack workspace started by SENTRY_USE_FAKE_SLACK."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--org", help="Organization slug. Defaults to the only organization, if there is one."
        )

    def handle(self, **options: str | None) -> None:
        if not settings.SENTRY_USE_FAKE_SLACK:
            raise CommandError(
                "Set SENTRY_USE_FAKE_SLACK = True in your Sentry config first, "
                "or Slack messages will go to the real Slack."
            )

        organization = self._get_organization(options["org"])
        integration, _ = Integration.objects.update_or_create(
            provider=IntegrationProviderSlug.SLACK.value,
            external_id=TEAM_ID,
            defaults={
                "name": TEAM_NAME,
                "status": ObjectStatus.ACTIVE,
                "metadata": {
                    "access_token": "xoxb-fake-slack",
                    "installation_type": "born_as_bot",
                    "domain_name": f"{TEAM_DOMAIN}.slack.com",
                    "scopes": sorted(SlackIntegrationProvider.identity_oauth_scopes),
                },
            },
        )
        integration.add_organization(organization)

        port = settings.SENTRY_FAKE_SLACK_PORT
        self.stdout.write(
            f"Connected {organization.slug} to the {TEAM_NAME} workspace "
            f"(integration {integration.id}).\n"
            f"Send Slack notifications to any channel, like #alerts, and see them in Fake Slack "
            f"on port {port} (http://localhost:{port} locally) while the devserver runs."
        )

    def _get_organization(self, slug: str | None) -> Organization:
        if slug:
            try:
                return Organization.objects.get(slug=slug)
            except Organization.DoesNotExist:
                raise CommandError(f"No organization with slug {slug!r}")
        organizations = list(Organization.objects.all()[:2])
        if len(organizations) != 1:
            raise CommandError("Pass --org <slug> to choose an organization.")
        return organizations[0]
