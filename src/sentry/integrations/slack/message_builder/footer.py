from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from sentry import roles
from sentry.models import Environment, Group, OrganizationMember, Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.utils.urls import get_settings_url
from sentry.types.integrations import ExternalProviders

# Defined as a variable so that other providers can more easily copy this file.
PROVIDER = ExternalProviders.SLACK


@dataclass
class FooterLink:
    label: str
    url: str

    SETTINGS_URL = object()


def build_link(link: FooterLink, provider: ExternalProviders) -> str:
    if provider == ExternalProviders.SLACK:
        return f"<{link.url}|{link.label}>"
    raise RuntimeError("Invalid Provider")


def process_footer_part(
    notification: BaseNotification,
    recipient: Team | User,
    provider: ExternalProviders,
    part: FooterLink | str,
) -> str:
    if isinstance(part, FooterLink):
        footer_link = part
        if footer_link is FooterLink.SETTINGS_URL:
            footer_link = FooterLink(
                label="Notification Settings",
                url=get_settings_url(notification, recipient, provider),
            )
        return build_link(footer_link, provider)

    return part


def build_footer(
    notification: BaseNotification,
    recipient: Team | User,
    provider: ExternalProviders,
    parts: Sequence[str],
) -> str:
    return " | ".join(
        [process_footer_part(notification, recipient, provider, part) for part in parts]
    )


def get_environment_name(group: Group | None) -> str | None:
    if not group:
        return None

    latest_event = group.get_latest_event()
    if not latest_event:
        return None

    try:
        environment = latest_event.get_environment()
    except Environment.DoesNotExist:
        return None

    environment_name: str | None = getattr(environment, "name", None)
    return environment_name


def get_role_string(member: OrganizationMember) -> str:
    if member.role == "billing":
        return "Billing Admin"
    role_string: str = roles.get(member.role).name
    return role_string
