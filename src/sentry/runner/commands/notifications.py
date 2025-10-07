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
@click.option("-o", "--organization_slug", help="Organization slug", default="default")
def send_slack(source: str, organization_slug: str) -> None:
    """
    Send a Slack
    - Example usage: `sentry notifications send slack -o <organization_slug> -s <source>`
    - To change the default workspace or channel, set the options slack.default-workspace and slack.default-channel in .sentry/config.yml
    """
    from sentry import options
    from sentry.runner import configure

    configure()

    integration_name = options.get("slack.default-workspace")
    channel = options.get("slack.default-channel")

    if integration_name == "example-workspace-name":
        click.echo("Please set the slack.default-workspace option in .sentry/config.yml")
        return

    if channel == "general":
        click.echo("INFO: You have not yet set a default channel, sending to the #general")

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

    slack_target = IntegrationNotificationTarget(
        provider_key=NotificationProviderKey.SLACK,
        resource_type=NotificationTargetResourceType.CHANNEL,
        integration_id=integration.id,
        resource_id=channel_data.channel_id,
        organization_id=organization_mapping.organization_id,
    )

    template_cls = template_registry.get(source)
    NotificationService(data=template_cls.example_data).notify(targets=[slack_target])

    click.echo(f"Example '{source}' slack message sent to {integration.name}.")


@send_cmd.command("msteams")
def send_msteams() -> None:
    """
    Send a Microsoft Teams notification.
    """
    click.echo("Not implemented yet!")


@send_cmd.command("discord")
def send_discord() -> None:
    """
    Send a Discord notification.
    """
    click.echo("Not implemented yet!")


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


@click.option(
    "-p", "--provider", help="the integration provider e.g. slack, discord, msteams", required=True
)
@click.option("-o", "--organization_slug", help="Organization slug", required=True)
@notifications.command("list-integrations")
def list_integrations(organization_slug: str, provider: str) -> None:
    """
    List all integrations available for a given provider
    - Optionally can be given an organization slug to show only integrations for that org
    """
    from sentry.runner import configure

    configure()

    from sentry.constants import ObjectStatus
    from sentry.integrations.models.organization_integration import OrganizationIntegration
    from sentry.integrations.types import IntegrationProviderSlug
    from sentry.models.organizationmapping import OrganizationMapping

    try:
        provider = IntegrationProviderSlug(provider)
    except ValueError:
        click.echo(f"Invalid provider: {provider}")
        return

    try:
        organization_mapping = OrganizationMapping.objects.get(slug=organization_slug)
    except OrganizationMapping.DoesNotExist:
        click.echo(f"Organization {organization_slug} not found!")
        return

    # Get organization integrations that belong to this organization and match our provider
    organization_integrations = OrganizationIntegration.objects.filter(
        integration__provider=provider,
        integration__status=ObjectStatus.ACTIVE,
        organization_id=organization_mapping.organization_id,
    ).select_related("integration")

    click.echo(
        f"All integrations for organization {organization_slug} with provider {provider}\n"
        f"Integration Name | Integration ID \n"
        f"----------------------------------"
    )
    for oi in organization_integrations:
        click.echo(f"{oi.integration.name} | {oi.integration.id}")
