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
def send_slack() -> None:
    """
    Send a Slack notification
    """
    click.echo("Not implemented yet!")


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
