from django.utils import timezone

from sentry.models import User
from sentry.models.project import Project
from sentry.signals import first_cron_checkin_received, first_cron_monitor_created

from .models import Monitor


def signal_first_checkin(project: Project, monitor: Monitor):
    if not project.flags.has_cron_checkins:
        # Backfill users that already have cron monitors
        signal_first_monitor_created(project, None, False)
        first_cron_checkin_received.send_robust(
            project=project, monitor_id=str(monitor.guid), sender=Project
        )


def signal_first_monitor_created(project: Project, user, from_upsert: bool):
    if not project.flags.has_cron_monitors:
        first_cron_monitor_created.send_robust(
            project=project, user=user, from_upsert=from_upsert, sender=Project
        )


def get_alert_rule(project: Project, user: User, monitor: Monitor, alert_rule: dict):
    """
    Gets a dict formatted alert rule to create alongside the monitor
    :param project: Project object
    :param user: User object that made the request
    :param monitor: Monitor object being created
    :param alert_rule: Dictionary of configurations for an associated Rule
    :return: dict
    """
    alert_rule_data = {
        "actionMatch": "any",
        "actions": [],
        "conditions": [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "name": "A new issue is created",
            },
            {
                "id": "sentry.rules.conditions.regression_event.RegressionEventCondition",
                "name": "The issue changes state from resolved to unresolved",
            },
        ],
        "createdBy": {
            "email": user.email,
            "id": user.id,
            "name": user.email,
        },
        "dateCreated": timezone.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "environment": None,
        "filterMatch": "all",
        "filters": [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "monitor.slug",
                "match": "eq",
                "name": f"The event's tags match monitor.slug contains {monitor.slug}",
                "value": monitor.slug,
            }
        ],
        "frequency": 1440,
        "name": f"{monitor.name} Monitor Alert (All environments) - All members",
        "owner": None,
        "projects": [project.slug],
        "snooze": False,
    }

    for target in alert_rule.get("targets", []):
        target_identifier = target["target_identifier"]
        target_type = target["target_type"]

        action = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "name": f"Send a notification to {target_type}",
            "targetIdentifier": target_identifier,
            "targetType": target_type,
        }
        alert_rule_data["actions"].append(action)

    return alert_rule_data
