from __future__ import annotations

import time
from typing import TYPE_CHECKING, Sequence
from urllib.parse import urlparse, urlunparse

from django.utils.http import urlencode

from sentry.incidents.models import AlertRuleTriggerAction
from sentry.models import Group, Organization, Project, Rule, Team, User
from sentry.notifications.types import get_notification_setting_type_name
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.notifications.notifications.base import BaseNotification
    from sentry.notifications.types import NotificationSettingTypes
    from sentry.notifications.utils import NotificationRuleDetails
    from sentry.types.integrations import ExternalProviders


def get_link_to_activity_tab_from_group_link(group_link: str) -> str:
    # TODO(mgaeta): Building link to activity tab this way is really fragile.
    parts = list(urlparse(group_link))
    parts[2] = parts[2].rstrip("/") + "/activity/"
    return urlunparse(parts)


def get_email_link_extra_params(
    referrer: str = "alert_email",
    environment: str | None = None,
    rule_details: Sequence[NotificationRuleDetails] | None = None,
    alert_timestamp: int | None = None,
) -> dict[int, str]:
    alert_timestamp_str = (
        str(round(time.time() * 1000)) if not alert_timestamp else str(alert_timestamp)
    )
    return {
        rule_detail.id: "?"
        + str(
            urlencode(
                {
                    "referrer": referrer,
                    "alert_type": str(AlertRuleTriggerAction.Type.EMAIL.name).lower(),
                    "alert_timestamp": alert_timestamp_str,
                    "alert_rule_id": rule_detail.id,
                    **dict([] if environment is None else [("environment", environment)]),
                }
            )
        )
        for rule_detail in (rule_details or [])
    }


def get_group_settings_link(
    group: Group,
    environment: str | None,
    rule_details: Sequence[NotificationRuleDetails] | None = None,
    alert_timestamp: int | None = None,
) -> str:
    alert_rule_id: int | None = rule_details[0].id if rule_details and rule_details[0].id else None
    return str(
        group.get_absolute_url()
        + (
            ""
            if not alert_rule_id
            else get_email_link_extra_params(
                "alert_email", environment, rule_details, alert_timestamp
            )[alert_rule_id]
        )
    )


def get_integration_link(organization: Organization, integration_slug: str) -> str:
    # Explicitly typing to satisfy mypy.
    integration_link: str = absolute_uri(
        f"/settings/{organization.slug}/integrations/{integration_slug}/?referrer=alert_email"
    )
    return integration_link


def build_rule_url(rule: Rule, group: Group, project: Project) -> str:
    org_slug = group.organization.slug
    project_slug = project.slug
    rule_url: str = absolute_uri(
        f"/organizations/{org_slug}/alerts/rules/{project_slug}/{rule.id}/"
    )
    return rule_url


def get_team_settings_url(team: Team) -> str:
    return f"/settings/{team.organization.slug}/teams/{team.slug}/notifications/"


def get_user_settings_url(type_key: NotificationSettingTypes | None = None) -> str:
    if not type_key:
        return "/settings/account/notifications/"

    fine_tuning_key = get_notification_setting_type_name(type_key)
    return f"/settings/account/notifications/{fine_tuning_key}/"


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
