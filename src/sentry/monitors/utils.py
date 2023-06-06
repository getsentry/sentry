from django.utils import timezone
from rest_framework.request import Request

from sentry.api.serializers.rest_framework.rule import RuleSerializer
from sentry.mediators import project_rules
from sentry.models import Rule, RuleActivity, RuleActivityType, RuleSource, User
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


def create_alert_rule(
    request: Request, project: Project, monitor: Monitor, validated_alert_rule: dict
):
    """
    Create an alert rule from a request with the given data
    :param request: Request object
    :param project: Project object
    :param monitor: Monitor object being created
    :param alert_rule: Dictionary of configurations for an associated Rule
    :return: dict
    """
    alert_rule_data = create_alert_rule_data(project, request.user, monitor, validated_alert_rule)
    serializer = RuleSerializer(
        context={"project": project, "organization": project.organization},
        data=alert_rule_data,
    )

    if not serializer.is_valid():
        return None

    data = serializer.validated_data
    # combine filters and conditions into one conditions criteria for the rule object
    conditions = data.get("conditions", [])
    if "filters" in data:
        conditions.extend(data["filters"])

    kwargs = {
        "name": data["name"],
        "environment": data.get("environment"),
        "project": project,
        "action_match": data["actionMatch"],
        "filter_match": data.get("filterMatch"),
        "conditions": conditions,
        "actions": data.get("actions", []),
        "frequency": data.get("frequency"),
        "user_id": request.user.id,
    }

    rule = project_rules.Creator.run(request=request, **kwargs)
    rule.update(source=RuleSource.CRON_MONITOR)
    RuleActivity.objects.create(
        rule=rule, user_id=request.user.id, type=RuleActivityType.CREATED.value
    )
    return rule.id


def create_alert_rule_data(project: Project, user: User, monitor: Monitor, alert_rule: dict):
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
        "environment": alert_rule.get("environment", None),
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
        "name": f"Monitor Alert: {monitor.name}"[:64],
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


def update_alert_rule(request: Request, project: Project, alert_rule: Rule, alert_rule_data: dict):
    actions = []
    for target in alert_rule_data.get("targets", []):
        target_identifier = target["target_identifier"]
        target_type = target["target_type"]

        action = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "name": f"Send a notification to {target_type}",
            "targetIdentifier": target_identifier,
            "targetType": target_type,
        }
        actions.append(action)

    serializer = RuleSerializer(
        context={"project": project, "organization": project.organization},
        data={"actions": actions},
        partial=True,
    )

    if serializer.is_valid():
        data = serializer.validated_data

        kwargs = {
            "project": project,
            "actions": data.get("actions", []),
        }

        updated_rule = project_rules.Updater.run(rule=alert_rule, request=request, **kwargs)

        RuleActivity.objects.create(
            rule=updated_rule, user_id=request.user.id, type=RuleActivityType.UPDATED.value
        )

    return alert_rule.id
