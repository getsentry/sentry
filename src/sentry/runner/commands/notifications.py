#!/usr/bin/env python

from typing import Any

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
    help="Registered template source (see `sentry notifications list`)",
    default="error-alert-service",
)
@click.option("-t", "--target", help="Recipient email address", default="user@example.com")
def send_email(source: str, target: str) -> None:
    """
    Send an email notification.
    Note: Requires configuring SMTP settings in .sentry/config.yml.
    """
    from sentry import options
    from sentry.runner import configure

    configure()

    if options.get("mail.backend") in {"dummy", "console"} or any(
        options.get(key) is None
        for key in ["mail.host", "mail.port", "mail.username", "mail.password"]
    ):
        click.echo("Unable to send email with current configuration!")
        click.echo(
            """Please update .sentry/config.yml:
  - remove `mail.backend` (if set to 'dummy' or 'console')
  - set `mail.host`, `mail.port`, `mail.username` and `mail.password`"""
        )
        return

    from sentry.notifications.platform.registry import template_registry
    from sentry.notifications.platform.service import NotificationService
    from sentry.notifications.platform.target import GenericNotificationTarget
    from sentry.notifications.platform.types import (
        NotificationProviderKey,
        NotificationTargetResourceType,
    )

    email_target = GenericNotificationTarget(
        provider_key=NotificationProviderKey.EMAIL,
        resource_type=NotificationTargetResourceType.EMAIL,
        resource_id=target,
    )
    template_cls = template_registry.get(source)
    NotificationService(data=template_cls.example_data).notify(targets=[email_target])
    click.echo(f"Example '{source}' email sent to {target}.")


@send_cmd.command("slack")
@click.option(
    "-s",
    "--source",
    help="Registered template source (see `sentry notifications list`)",
    default="error-alert-service",
)
@click.option(
    "-w", "--integration_name", help="Integration name", default="sentry-ecosystem"
)  # default is sentry-ecosystem workspace
@click.option("-o", "--organization_slug", help="Organization slug", default="post-db-wipe")
@click.option("-c", "--channel", help="Channel name", default="christina-test")
def send_slack(source: str, integration_name: str, organization_slug: str, channel: str) -> None:
    """
    Send a Slack notification
    - Default sends to sentry-ecosystem organization and #general channel
    """
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
        organization = OrganizationMapping.objects.get(slug=organization_slug)
    except OrganizationMapping.DoesNotExist:
        click.echo(f"Organization {organization_slug} not found!")
        return

    try:
        integration = Integration.objects.get(
            name=integration_name,
            provider=IntegrationProviderSlug.SLACK,
            status=ObjectStatus.ACTIVE,
        )
    except Integration.DoesNotExist:
        click.echo(f"Integration {integration_name} not found!")
        return

    try:
        channel_data = get_channel_id(integration=integration, channel_name=channel)
    except Exception as e:
        click.echo(f"Error getting channel id: {e}")
        return

    if channel_data.channel_id is None:
        click.echo(f"Channel {channel} not found!")
        return

    discord_target = IntegrationNotificationTarget(
        provider_key=NotificationProviderKey.DISCORD,
        resource_type=NotificationTargetResourceType.CHANNEL,
        integration_id=integration.id,
        resource_id=channel_data.channel_id,
        organization_id=organization.organization_id,
    )

    template_cls = template_registry.get(source)
    NotificationService(data=template_cls.example_data).notify(targets=[discord_target])

    click.echo(f"Example '{source}' discord message sent to {integration.name}.")


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
    help="Registered template source (see `sentry notifications list`)",
    default="error-alert-service",
)
@click.option("-o", "--organization_slug", help="Organization slug", default="default")
def send_discord(source: str, integration_name: str, organization_slug: str, channel: str) -> None:
    """
    Send a Discord notification
    - Requires configuring Discord default-server-id and default-channel-id in .sentry/config.yml
    - To get a Discord channel id - follow step 6 of the metric alert instructions
        - https://docs.sentry.io/organization/integrations/notification-incidents/discord/#metric-alerts
    """
    from sentry import options
    from sentry.runner import configure

    configure()

    channel = options.get("discord.default-channel-id")
    integration_name = options.get("discord.default-server-id")

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
        organization = OrganizationMapping.objects.get(slug=organization_slug)
    except OrganizationMapping.DoesNotExist:
        click.echo(f"Organization {organization_slug} not found!")
        return

    try:
        integration = Integration.objects.get(
            name=integration_name,
            provider=IntegrationProviderSlug.DISCORD,
            status=ObjectStatus.ACTIVE,
        )
    except Integration.DoesNotExist:
        click.echo(f"Integration {integration_name} not found!")
        return

    discord_target = IntegrationNotificationTarget(
        provider_key=NotificationProviderKey.DISCORD,
        resource_type=NotificationTargetResourceType.CHANNEL,
        integration_id=integration.id,
        resource_id=channel,
        organization_id=organization.organization_id,
    )

    template_cls = template_registry.get(source)
    NotificationService(data=template_cls.example_data).notify(targets=[discord_target])

    click.echo(f"Example '{source}' discord message sent to {integration.name}.")


@notifications.command("list")
def list_cmd() -> None:
    """
    Lists registered notification data.
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
