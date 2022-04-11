from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence
from urllib.parse import urlencode

from sentry import roles
from sentry.models import Environment, Group, OrganizationMember, Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.types import NotificationSettingTypes, get_notification_setting_type_name
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

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

    return getattr(environment, "name", None)


def get_team_settings_url(team: Team) -> str:
    return f"/settings/{team.organization.slug}/teams/{team.slug}/notifications/"


def get_user_settings_url(type_key: NotificationSettingTypes | None = None) -> str:
    if not type_key:
        return "/settings/account/notifications/"

    fine_tuning_key = get_notification_setting_type_name(type_key)
    return f"/settings/account/notifications/{fine_tuning_key}"


def get_settings_url(
    notification: BaseNotification,
    recipient: Team | User,
    provider: ExternalProviders,
) -> str:
    if isinstance(recipient, Team):
        team = Team.objects.get(id=recipient.id)
        url = get_team_settings_url(team)
    else:
        url = get_user_settings_url(notification.notification_setting_type)

    params = notification.get_tracking_params(provider, recipient)
    return f"{absolute_uri(url)}?{urlencode(params)}"


def get_role_string(member: OrganizationMember) -> str:
    if member.role == "billing":
        return "Billing Admin"
    return roles.get(member.role).name
