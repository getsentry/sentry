from __future__ import annotations

from typing import Optional, Sequence

from django.db.models import Q

from sentry.incidents.models import AlertRule, AlertRuleStatus
from sentry.models.actor import ACTOR_TYPES, Actor
from sentry.models.organization import Organization
from sentry.snuba.dataset import Dataset
from sentry.utils.email import MessageBuilder

TEMPLATE = "alert_migration"


def send_alert_migration_emails(organization: Organization) -> None:
    dataset = Dataset.PerformanceMetrics.value  # change to transactions
    alerts = AlertRule.objects.filter(
        ~Q(status=AlertRuleStatus.SNAPSHOT.value), snuba_query__dataset=dataset
    )

    # group by owner
    owner_alerts = {}
    for alert in alerts:
        if alert.owner in owner_alerts:
            owner_alerts[alert.owner].append(alert)
        else:
            owner_alerts[alert.owner] = [alert]

    emails_to_send = []
    for owner, alerts in owner_alerts.items():
        recipients = get_recipients(organization, owner)
        message = generate_email(organization, alerts)

        emails_to_send.append((message, recipients))

    return emails_to_send


def get_recipients(organization: Organization, owner: Optional[Actor]) -> Sequence[str]:
    if not owner:
        return [organization.get_default_owner().email]

    if owner.type == ACTOR_TYPES["team"]:
        return [member.user_email for member in owner.team.member_set.filter(user_is_active=True)]
    elif owner.type == ACTOR_TYPES["user"]:
        return [owner.email]
    else:
        return []


def generate_email(organization: Organization, alerts: Sequence[AlertRule]):
    base_url = f"{organization.get_url(organization.slug)}/alerts/rules/"
    affected_alerts = [(f"{base_url}/{alert.id}", alert.name) for alert in alerts]

    return MessageBuilder(
        subject="[Action Recommended] Performance based alerts just got a lot more accurate.",
        context={"alerts_url": f"{base_url}", "affected_alerts": affected_alerts},
        template=f"sentry/emails/{TEMPLATE}.txt",
        html_template=f"sentry/emails/{TEMPLATE}.html",
    )
