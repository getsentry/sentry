#!/usr/bin/env python
from typing import int, Any

import click


@click.group()
def notifications() -> None:
    """
    Utilities to debug notifications locally.
    """


@notifications.group("send")
def send_cmd() -> None:
    """
    Send debugging notification through a provider.
    """


@send_cmd.command("email")
@click.option(
    "-s",
    "--source",
    help="Registered template source (see `sentry notifications list registry`)",
    default="error-alert-service",
)
@click.option("-e", "--email", help="Recipient email address", default="user@example.com")
def send_email(source: str, email: str) -> None:
    """
    Send an email notification.
    Note: Requires configuring SMTP settings in .sentry/config.yml.
    """
    from sentry import options
    from sentry.runner import configure

    configure()

    from sentry.notifications.platform.registry import template_registry
    from sentry.notifications.platform.service import NotificationService
    from sentry.notifications.platform.target import GenericNotificationTarget
    from sentry.notifications.platform.types import (
        NotificationProviderKey,
        NotificationTargetResourceType,
    )

    if options.get("mail.backend") in {"dummy", "console"} or any(
        options.get(key) is None
        for key in ["mail.host", "mail.port", "mail.username", "mail.password"]
    ):
        click.echo("Unable to send email with current configuration!")
        click.echo(
            "Please update .sentry/config.yml:"
            "\n  - remove `mail.backend` (if set to 'dummy' or 'console')"
            "\n  - set `mail.host`, `mail.port`, `mail.username` and `mail.password`"
        )
        return

    email_target = GenericNotificationTarget(
        provider_key=NotificationProviderKey.EMAIL,
        resource_type=NotificationTargetResourceType.EMAIL,
        resource_id=email,
    )
    template_cls = template_registry.get(source)
    NotificationService(data=template_cls.example_data).notify_sync(targets=[email_target])
    click.echo(f"Example '{source}' email sent to {email}.")


@send_cmd.command("slack")
@click.option(
    "-s",
    "--source",
    help="Registered template source (see `sentry notifications list registry`)",
    default="error-alert-service",
)
@click.option("-o", "--organization_slug", help="Organization slug")
@click.option("-i", "--integration_name", help="Slack integration name", default=None)
@click.option("-c", "--channel_name", help="Slack channel name", default=None)
def send_slack(
    source: str, organization_slug: str, integration_name: str | None, channel_name: str | None
) -> None:
    """
    Send a Slack notification.
    """
    from sentry import options
    from sentry.runner import configure

    configure()

    from sentry.constants import ObjectStatus
    from sentry.integrations.models.integration import Integration
    from sentry.integrations.slack.utils.channel import get_channel_id
    from sentry.integrations.types import IntegrationProviderSlug
    from sentry.models.organizationmapping import OrganizationMapping
    from sentry.notifications.platform.registry import template_registry
    from sentry.notifications.platform.service import NotificationService
    from sentry.notifications.platform.target import IntegrationNotificationTarget
    from sentry.notifications.platform.types import (
        NotificationProviderKey,
        NotificationTargetResourceType,
    )

    try:
        organization_mapping = OrganizationMapping.objects.get(slug=organization_slug)
    except OrganizationMapping.DoesNotExist:
        click.echo(f"Organization '{organization_slug}' not found!")
        return

    integration_name = integration_name or options.get("slack.debug-workspace")
    if integration_name is None or integration_name == "":
        click.echo(
            "\nThis command requires a slack integration name."
            "\nProvide it with the `-i` flag or by setting `slack.debug-workspace` in .sentry/config.yml."
            f"\nBrowse the local integrations with `sentry notifications list integrations -o {organization_slug}`."
        )
        return

    try:
        integration = Integration.objects.get(
            provider=IntegrationProviderSlug.SLACK.value,
            name=integration_name,
            status=ObjectStatus.ACTIVE,
        )
    except Integration.DoesNotExist:
        click.echo(f"Slack integration '{integration_name}' not found!")
        return

    channel_name = channel_name or options.get("slack.debug-channel")
    if channel_name is None or channel_name == "":
        click.echo(
            "\nThis command requires a slack channel name."
            "\nProvide it with the `-c` flag or by setting `slack.debug-channel` in .sentry/config.yml."
        )
        return

    try:
        channel_data = get_channel_id(integration=integration, channel_name=channel_name)
    except Exception as e:
        click.echo(f"Error getting channel ID: {e}")
        return

    if channel_data.channel_id is None:
        click.echo(f"Channel '{channel_name}' not found!")
        return

    slack_target = IntegrationNotificationTarget(
        provider_key=NotificationProviderKey.SLACK,
        resource_type=NotificationTargetResourceType.CHANNEL,
        integration_id=integration.id,
        resource_id=channel_data.channel_id,
        organization_id=organization_mapping.organization_id,
    )

    template_cls = template_registry.get(source)
    NotificationService(data=template_cls.example_data).notify_sync(targets=[slack_target])
    click.echo(f"Example '{source}' slack message sent to {integration.name}.")


@send_cmd.command("msteams")
def send_msteams() -> None:
    """
    Send a Microsoft Teams notification.
    """
    click.echo("Not implemented yet!")


@send_cmd.command("discord")
@click.option(
    "-s",
    "--source",
    help="Registered template source (see `sentry notifications list registry`)",
    default="error-alert-service",
)
@click.option("-o", "--organization_slug", help="Organization slug", required=True)
@click.option("-i", "--integration_name", help="Discord integration name", default=None)
@click.option("-c", "--channel_id", help="Discord channel ID", default=None)
def send_discord(
    source: str,
    organization_slug: str,
    integration_name: str | None,
    channel_id: str | None,
) -> None:
    """
    Send a Discord notification.
    """
    from sentry import options
    from sentry.runner import configure

    configure()

    from sentry.constants import ObjectStatus
    from sentry.integrations.models.integration import Integration
    from sentry.integrations.types import IntegrationProviderSlug
    from sentry.models.organizationmapping import OrganizationMapping
    from sentry.notifications.platform.registry import template_registry
    from sentry.notifications.platform.service import NotificationService
    from sentry.notifications.platform.target import IntegrationNotificationTarget
    from sentry.notifications.platform.types import (
        NotificationProviderKey,
        NotificationTargetResourceType,
    )

    try:
        organization_mapping = OrganizationMapping.objects.get(slug=organization_slug)
    except OrganizationMapping.DoesNotExist:
        click.echo(f"Organization '{organization_slug}' not found!")
        return

    integration_name = integration_name or options.get("discord.debug-server")
    if integration_name is None or integration_name == "":
        click.echo(
            "\nThis command requires a discord integration name."
            "\nProvide it with the `-i` flag or by setting `discord.debug-server` in .sentry/config.yml."
            f"\nBrowse the local integrations with `sentry notifications list integrations -o {organization_slug}`."
        )
        return

    try:
        integration = Integration.objects.get(
            provider=IntegrationProviderSlug.DISCORD.value,
            name=integration_name,
            status=ObjectStatus.ACTIVE,
        )
    except Integration.DoesNotExist:
        click.echo(f"Discord integration '{integration_name}' not found!")
        return

    channel_id = channel_id or options.get("discord.debug-channel")
    if channel_id is None or channel_id == "":
        click.echo(
            "\nThis command requires a discord channel ID."
            "\nProvide it with the `-c` flag or by setting `discord.debug-channel` in .sentry/config.yml."
        )
        return

    discord_target = IntegrationNotificationTarget(
        provider_key=NotificationProviderKey.DISCORD,
        resource_type=NotificationTargetResourceType.CHANNEL,
        resource_id=channel_id,
        integration_id=integration.id,
        organization_id=organization_mapping.organization_id,
    )

    template_cls = template_registry.get(source)
    NotificationService(data=template_cls.example_data).notify_sync(targets=[discord_target])
    click.echo(f"Example '{source}' discord message sent to channel with ID {channel_id}.")


@notifications.group("list")
def list_cmd() -> None:
    """
    Lists notification data.
    """


@list_cmd.command("registry")
def list_registry() -> None:
    """
    Lists all registered notification providers and templates.
    """
    from sentry.runner import configure

    configure()

    from sentry.notifications.platform.registry import provider_registry, template_registry
    from sentry.notifications.platform.types import NotificationCategory

    click.echo("\nRegistered notification providers:")
    for provider_key, provider_cls in provider_registry.registrations.items():
        click.echo(f"• key: {provider_key}, class: {provider_cls.__name__}")

    click.echo("\nRegistered notification templates:")
    # XXX: For some reason, using a defaultdict(list) here causes the command to interpret
    # the .append() as new arguments, causing an early exit and error.
    category_to_sources: dict[NotificationCategory, Any] = {}
    for source, template_cls in template_registry.registrations.items():
        category = template_cls.category
        if category not in category_to_sources:
            category_to_sources[category] = []
        category_to_sources[category].append({"source": source, "class": template_cls.__name__})
    for category, sources in category_to_sources.items():
        click.echo(f"• category: {category}")
        for source in sources:
            click.echo(f"  ◦ source: {source['source']}, class: {source['class']}")


@click.option("-o", "--organization_slug", help="Organization slug", required=True)
@list_cmd.command("integrations")
def list_integrations(organization_slug: str) -> None:
    """
    Lists integration data for an organization.
    """
    from sentry.runner import configure

    configure()

    from sentry.constants import ObjectStatus
    from sentry.integrations.models.organization_integration import OrganizationIntegration
    from sentry.models.organizationmapping import OrganizationMapping

    try:
        organization_mapping = OrganizationMapping.objects.get(slug=organization_slug)
    except OrganizationMapping.DoesNotExist:
        click.echo(f"Organization {organization_slug} not found!")
        return

    # Get organization integrations that belong to this organization and match our provider
    organization_integrations = OrganizationIntegration.objects.filter(
        integration__status=ObjectStatus.ACTIVE,
        organization_id=organization_mapping.organization_id,
    ).select_related("integration")

    click.echo(f"\nIntegration data for '{organization_slug}' organization:")
    for oi in organization_integrations:
        click.echo(
            f"• id: {oi.integration.id}, provider: {oi.integration.provider}, name: {oi.integration.name}"
        )
