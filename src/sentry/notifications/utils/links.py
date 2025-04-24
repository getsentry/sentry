"""
This file contains simple functions to generate links to Sentry pages

We can use this as a basepoint to build out our templating system in the future
"""

import time
from collections.abc import Sequence
from typing import Any

from django.utils.http import urlencode

from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.types.rules import NotificationRuleDetails


def create_link_to_workflow(organization_id: int, workflow_id: str) -> str:
    """
    Create a link to a workflow
    """
    return f"/organizations/{organization_id}/issues/automations/{workflow_id}/"


def get_email_link_extra_params(
    referrer: str = "alert_email",
    environment: str | None = None,
    rule_details: Sequence[NotificationRuleDetails] | None = None,
    alert_timestamp: int | None = None,
    notification_uuid: str | None = None,
    **kwargs: Any,
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
                    **dict(
                        []
                        if notification_uuid is None
                        else [("notification_uuid", str(notification_uuid))]
                    ),
                    **dict([] if environment is None else [("environment", environment)]),
                    **kwargs,
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
    referrer: str = "alert_email",
    notification_uuid: str | None = None,
    **kwargs: Any,
) -> str:
    alert_rule_id = rule_details[0].id if rule_details and rule_details[0].id else None
    extra_params = ""
    if alert_rule_id:
        extra_params = get_email_link_extra_params(
            referrer,
            environment,
            rule_details,
            alert_timestamp,
            notification_uuid=notification_uuid,
            **kwargs,
        )[alert_rule_id]
    elif not alert_rule_id and notification_uuid:
        extra_params = "?" + str(urlencode({"notification_uuid": notification_uuid}))
    return str(group.get_absolute_url() + extra_params)


def get_integration_link(
    organization: Organization, integration_slug: str, notification_uuid: str | None = None
) -> str:
    query_params = {"referrer": "alert_email"}
    if notification_uuid:
        query_params.update({"notification_uuid": notification_uuid})

    return organization.absolute_url(
        f"/settings/{organization.slug}/integrations/{integration_slug}/",
        query=urlencode(query_params),
    )


def get_issue_replay_link(group: Group, sentry_query_params: str = ""):
    return str(group.get_absolute_url() + "replays/" + sentry_query_params)
