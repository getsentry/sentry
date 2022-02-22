import logging
from datetime import timedelta
from urllib.parse import urlencode

from django.urls import reverse

from sentry.auth.access import from_user
from sentry.incidents.models import (
    INCIDENT_STATUS,
    AlertRule,
    AlertRuleStatus,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentStatus,
    IncidentStatusMethod,
)
from sentry.models import Project
from sentry.snuba.query_subscription_consumer import register_subscriber
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)

INCIDENTS_SNUBA_SUBSCRIPTION_TYPE = "incidents"
INCIDENT_SNAPSHOT_BATCH_SIZE = 50
SUBSCRIPTION_METRICS_LOGGER = "subscription_metrics_logger"


@instrumented_task(name="sentry.incidents.tasks.send_subscriber_notifications", queue="incidents")
def send_subscriber_notifications(activity_id):
    from sentry.incidents.logic import get_incident_subscribers, unsubscribe_from_incident

    try:
        activity = IncidentActivity.objects.select_related(
            "incident", "user", "incident__organization"
        ).get(id=activity_id)
    except IncidentActivity.DoesNotExist:
        return

    # Only send notifications for specific activity types.
    if activity.type not in (
        IncidentActivityType.COMMENT.value,
        IncidentActivityType.STATUS_CHANGE.value,
    ):
        return

    # Check that the user still has access to at least one of the projects
    # related to the incident. If not then unsubscribe them.
    projects = list(activity.incident.projects.all())
    for subscriber in get_incident_subscribers(activity.incident).select_related("user"):
        user = subscriber.user
        access = from_user(user, activity.incident.organization)
        if not any(project for project in projects if access.has_project_access(project)):
            unsubscribe_from_incident(activity.incident, user)
        elif user != activity.user:
            msg = generate_incident_activity_email(activity, user)
            msg.send_async([user.email])


def generate_incident_activity_email(activity, user):
    incident = activity.incident
    return MessageBuilder(
        subject=f"Activity on Alert {incident.title} (#{incident.identifier})",
        template="sentry/emails/incidents/activity.txt",
        html_template="sentry/emails/incidents/activity.html",
        type="incident.activity",
        context=build_activity_context(activity, user),
    )


def build_activity_context(activity, user):
    if activity.type == IncidentActivityType.COMMENT.value:
        action = "left a comment"
    else:
        action = "changed status from {} to {}".format(
            INCIDENT_STATUS[IncidentStatus(int(activity.previous_value))],
            INCIDENT_STATUS[IncidentStatus(int(activity.value))],
        )
    incident = activity.incident

    action = f"{action} on alert {incident.title} (#{incident.identifier})"

    return {
        "user_name": activity.user.name if activity.user else "Sentry",
        "action": action,
        "link": absolute_uri(
            reverse(
                "sentry-metric-alert",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "incident_id": incident.identifier,
                },
            )
        )
        + "?"
        + urlencode({"referrer": "incident_activity_email"}),
        "comment": activity.comment,
    }


@register_subscriber(SUBSCRIPTION_METRICS_LOGGER)
def handle_subscription_metrics_logger(subscription_update, subscription):
    """
    Logs results from a `QuerySubscription`.
    :param subscription_update: dict formatted according to schemas in
    sentry.snuba.json_schemas.SUBSCRIPTION_PAYLOAD_VERSIONS
    :param subscription: The `QuerySubscription` that this update is for
    """
    from sentry.incidents.subscription_processor import SubscriptionProcessor

    try:
        processor = SubscriptionProcessor(subscription)
        processor.alert_rule = AlertRule()
        aggregation_value = int(processor.get_aggregation_value(subscription_update))
        processor.alert_rule.comparison_delta = int(timedelta(days=7).total_seconds())
        comparison_value = processor.get_aggregation_value(subscription_update)
        tags = {
            "project_id": subscription.project_id,
            "project_slug": subscription.project.slug,
            "subscription_id": subscription.id,
            "time_window": subscription.snuba_query.time_window,
        }
        metrics.incr("subscriptions.result.value", aggregation_value, tags=tags, sample_rate=1.0)
        if comparison_value is not None:
            metrics.incr(
                "subscriptions.result.comparison", int(comparison_value), tags=tags, sample_rate=1.0
            )
    except Exception:
        logger.exception("Failed to log subscription results")


@register_subscriber(INCIDENTS_SNUBA_SUBSCRIPTION_TYPE)
def handle_snuba_query_update(subscription_update, subscription):
    """
    Handles a subscription update for a `QuerySubscription`.
    :param subscription_update: dict formatted according to schemas in
    sentry.snuba.json_schemas.SUBSCRIPTION_PAYLOAD_VERSIONS
    :param subscription: The `QuerySubscription` that this update is for
    """
    from sentry.incidents.subscription_processor import SubscriptionProcessor

    # noinspection SpellCheckingInspection
    with metrics.timer("incidents.subscription_procesor.process_update"):
        SubscriptionProcessor(subscription).process_update(subscription_update)


@instrumented_task(
    name="sentry.incidents.tasks.handle_trigger_action",
    queue="incidents",
    default_retry_delay=60,
    max_retries=5,
)
def handle_trigger_action(action_id, incident_id, project_id, method, metric_value=None, **kwargs):
    from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL, WARNING_TRIGGER_LABEL

    try:
        action = AlertRuleTriggerAction.objects.select_related(
            "alert_rule_trigger", "alert_rule_trigger__alert_rule"
        ).get(id=action_id)
    except AlertRuleTriggerAction.DoesNotExist:
        metrics.incr("incidents.alert_rules.action.skipping_missing_action")
        return

    try:
        incident = Incident.objects.select_related("organization").get(id=incident_id)
    except Incident.DoesNotExist:
        metrics.incr("incidents.alert_rules.action.skipping_missing_incident")
        return

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        metrics.incr("incidents.alert_rules.action.skipping_missing_project")
        return

    metrics.incr(
        "incidents.alert_rules.action.{}.{}".format(
            AlertRuleTriggerAction.Type(action.type).name.lower(), method
        )
    )
    if method == "resolve":
        if (
            action.alert_rule_trigger.label == CRITICAL_TRIGGER_LABEL
            and AlertRuleTrigger.objects.filter(
                alert_rule=action.alert_rule_trigger.alert_rule,
                label=WARNING_TRIGGER_LABEL,
            ).exists()
        ):
            # If we're resolving a critical trigger and a warning exists then we want to treat this
            # as if firing a warning, rather than resolving this trigger
            new_status = IncidentStatus.WARNING
        else:
            new_status = IncidentStatus.CLOSED
    else:
        if action.alert_rule_trigger.label == CRITICAL_TRIGGER_LABEL:
            new_status = IncidentStatus.CRITICAL
        else:
            new_status = IncidentStatus.WARNING

    getattr(action, method)(
        action, incident, project, metric_value=metric_value, new_status=new_status
    )


@instrumented_task(
    name="sentry.incidents.tasks.auto_resolve_snapshot_incidents",
    queue="incidents",
    default_retry_delay=60,
    max_retries=2,
)
def auto_resolve_snapshot_incidents(alert_rule_id, **kwargs):
    from sentry.incidents.logic import update_incident_status
    from sentry.incidents.models import AlertRule

    try:
        alert_rule = AlertRule.objects_with_snapshots.get(id=alert_rule_id)
    except AlertRule.DoesNotExist:
        return

    if alert_rule.status != AlertRuleStatus.SNAPSHOT.value:
        return

    batch_size = 50
    incidents = Incident.objects.filter(alert_rule=alert_rule).exclude(
        status=IncidentStatus.CLOSED.value
    )[: batch_size + 1]
    has_more = incidents.count() > batch_size
    if incidents:
        incidents = incidents[:batch_size]
        for incident in incidents:
            update_incident_status(
                incident,
                IncidentStatus.CLOSED,
                comment="This alert has been auto-resolved because the rule that triggered it has been modified or deleted.",
                status_method=IncidentStatusMethod.RULE_UPDATED,
            )

    if has_more:
        auto_resolve_snapshot_incidents.apply_async(
            kwargs={"alert_rule_id": alert_rule_id}, countdown=1
        )
