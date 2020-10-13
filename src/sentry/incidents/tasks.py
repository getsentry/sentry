from __future__ import absolute_import

import logging

from django.db import transaction
from django.core.urlresolvers import reverse
from django.utils import timezone
from six.moves.urllib.parse import urlencode

from sentry.auth.access import from_user
from sentry.incidents.models import (
    AlertRuleTriggerAction,
    AlertRuleStatus,
    Incident,
    IncidentProject,
    PendingIncidentSnapshot,
    IncidentSnapshot,
    IncidentActivity,
    IncidentActivityType,
    IncidentStatus,
    IncidentStatusMethod,
    INCIDENT_STATUS,
)
from sentry.models import Project
from sentry.snuba.query_subscription_consumer import register_subscriber
from sentry.tasks.base import instrumented_task
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils import metrics

logger = logging.getLogger(__name__)

INCIDENTS_SNUBA_SUBSCRIPTION_TYPE = "incidents"


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
        subject=u"Activity on Alert {} (#{})".format(incident.title, incident.identifier),
        template=u"sentry/emails/incidents/activity.txt",
        html_template=u"sentry/emails/incidents/activity.html",
        type="incident.activity",
        context=build_activity_context(activity, user),
    )


def build_activity_context(activity, user):
    if activity.type == IncidentActivityType.COMMENT.value:
        action = "left a comment"
    else:
        action = "changed status from %s to %s" % (
            INCIDENT_STATUS[IncidentStatus(int(activity.previous_value))],
            INCIDENT_STATUS[IncidentStatus(int(activity.value))],
        )
    incident = activity.incident

    action = "%s on alert %s (#%s)" % (action, incident.title, incident.identifier)

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
    getattr(action, method)(incident, project, metric_value=metric_value)


@instrumented_task(
    name="sentry.incidents.tasks.auto_resolve_snapshot_incidents",
    queue="incidents",
    default_retry_delay=60,
    max_retries=2,
)
def auto_resolve_snapshot_incidents(alert_rule_id, **kwargs):
    from sentry.incidents.models import AlertRule
    from sentry.incidents.logic import update_incident_status

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


@instrumented_task(
    name="sentry.incidents.tasks.process_pending_incident_snapshots", queue="incident_snapshots"
)
def process_pending_incident_snapshots():
    """
    Processes PendingIncidentSnapshots and creates a snapshot for any snapshot that
    has passed it's target_run_date.
    """
    from sentry.incidents.logic import create_incident_snapshot

    batch_size = 50

    now = timezone.now()
    pending_snapshots = PendingIncidentSnapshot.objects.filter(
        target_run_date__lte=now
    ).select_related("incident")

    if not pending_snapshots:
        return

    for processed, pending_snapshot in enumerate(pending_snapshots):
        incident = pending_snapshot.incident
        if processed > batch_size:
            process_pending_incident_snapshots.apply_async(countdown=1)
            break
        else:
            try:
                with transaction.atomic():
                    if (
                        incident.status == IncidentStatus.CLOSED.value
                        and not IncidentSnapshot.objects.filter(incident=incident).exists()
                    ):
                        if IncidentProject.objects.filter(incident=incident).exists():
                            create_incident_snapshot(incident, windowed_stats=True)
                    pending_snapshot.delete()
            except Exception:
                logger.exception("An error occurred while taking an incident snapshot")
