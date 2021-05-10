import abc

from django.template.defaultfilters import pluralize
from django.urls import reverse

from sentry.incidents.models import (
    INCIDENT_STATUS,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
    IncidentStatus,
    IncidentTrigger,
    TriggerStatus,
)
from sentry.models.notificationsetting import NotificationSetting
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri


class ActionHandler(metaclass=abc.ABCMeta):
    status_display = {TriggerStatus.ACTIVE: "Fired", TriggerStatus.RESOLVED: "Resolved"}

    def __init__(self, action, incident, project):
        self.action = action
        self.incident = incident
        self.project = project

    @abc.abstractmethod
    def fire(self, metric_value):
        pass

    @abc.abstractmethod
    def resolve(self, metric_value):
        pass


class DefaultActionHandler(ActionHandler):
    def fire(self, metric_value):
        self.send_alert(metric_value, "fire")

    def resolve(self, metric_value):
        self.send_alert(metric_value, "resolve")

    @abc.abstractmethod
    def send_alert(self, metric_value):
        pass


@AlertRuleTriggerAction.register_type(
    "email",
    AlertRuleTriggerAction.Type.EMAIL,
    [AlertRuleTriggerAction.TargetType.USER, AlertRuleTriggerAction.TargetType.TEAM],
)
class EmailActionHandler(ActionHandler):
    def get_targets(self):
        target = self.action.target
        if not target:
            return []
        targets = []
        if self.action.target_type in (
            AlertRuleTriggerAction.TargetType.USER.value,
            AlertRuleTriggerAction.TargetType.TEAM.value,
        ):
            if self.action.target_type == AlertRuleTriggerAction.TargetType.USER.value:
                targets = [(target.id, target.email)]
            elif self.action.target_type == AlertRuleTriggerAction.TargetType.TEAM.value:
                users = NotificationSetting.objects.filter_to_subscribed_users(
                    self.project,
                    {member.user for member in target.member_set},
                )[ExternalProviders.EMAIL]
                targets = [(user.id, user.email) for user in users]
        # TODO: We need some sort of verification system to make sure we're not being
        # used as an email relay.
        # elif self.action.target_type == AlertRuleTriggerAction.TargetType.SPECIFIC.value:
        #     emails = [target]
        return targets

    def fire(self, metric_value):
        self.email_users(TriggerStatus.ACTIVE)

    def resolve(self, metric_value):
        self.email_users(TriggerStatus.RESOLVED)

    def email_users(self, status):
        email_context = generate_incident_trigger_email_context(
            self.project, self.incident, self.action.alert_rule_trigger, status
        )
        for user_id, email in self.get_targets():
            self.build_message(email_context, status, user_id).send_async(to=[email])

    def build_message(self, context, status, user_id):
        display = self.status_display[status]
        return MessageBuilder(
            subject="[{}] {} - {}".format(
                context["status"], context["incident_name"], self.project.slug
            ),
            template="sentry/emails/incidents/trigger.txt",
            html_template="sentry/emails/incidents/trigger.html",
            type=f"incident.alert_rule_{display.lower()}",
            context=context,
            headers={"X-SMTPAPI": json.dumps({"category": "metric_alert_email"})},
        )


@AlertRuleTriggerAction.register_type(
    "slack",
    AlertRuleTriggerAction.Type.SLACK,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="slack",
)
class SlackActionHandler(DefaultActionHandler):
    def send_alert(self, metric_value, method):
        from sentry.integrations.slack.utils import send_incident_alert_notification

        send_incident_alert_notification(self.action, self.incident, metric_value, method)


@AlertRuleTriggerAction.register_type(
    "msteams",
    AlertRuleTriggerAction.Type.MSTEAMS,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="msteams",
)
class MsTeamsActionHandler(DefaultActionHandler):
    def send_alert(self, metric_value, method):
        from sentry.integrations.msteams.utils import send_incident_alert_notification

        send_incident_alert_notification(self.action, self.incident, metric_value, method)


@AlertRuleTriggerAction.register_type(
    "pagerduty",
    AlertRuleTriggerAction.Type.PAGERDUTY,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="pagerduty",
)
class PagerDutyActionHandler(DefaultActionHandler):
    def send_alert(self, metric_value, method):
        from sentry.integrations.pagerduty.utils import send_incident_alert_notification

        send_incident_alert_notification(self.action, self.incident, metric_value, method)


@AlertRuleTriggerAction.register_type(
    "sentry_app",
    AlertRuleTriggerAction.Type.SENTRY_APP,
    [AlertRuleTriggerAction.TargetType.SENTRY_APP],
)
class SentryAppActionHandler(DefaultActionHandler):
    def send_alert(self, metric_value, method):
        from sentry.rules.actions.notify_event_service import send_incident_alert_notification

        send_incident_alert_notification(self.action, self.incident, metric_value, method)


def format_duration(minutes):
    """
    Format minutes into a duration string
    """

    if minutes >= 1440:
        days = int(minutes // 1440)
        return f"{days:d} day{pluralize(days)}"

    if minutes >= 60:
        hours = int(minutes // 60)
        return f"{hours:d} hour{pluralize(hours)}"

    if minutes >= 1:
        minutes = int(minutes)
        return f"{minutes:d} minute{pluralize(minutes)}"

    seconds = int(minutes // 60)
    return f"{seconds:d} second{pluralize(seconds)}"


def generate_incident_trigger_email_context(project, incident, alert_rule_trigger, status):
    trigger = alert_rule_trigger
    incident_trigger = IncidentTrigger.objects.get(incident=incident, alert_rule_trigger=trigger)

    alert_rule = trigger.alert_rule
    snuba_query = alert_rule.snuba_query
    is_active = status == TriggerStatus.ACTIVE
    is_threshold_type_above = alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value

    # if alert threshold and threshold type is above then show '>'
    # if resolve threshold and threshold type is *BELOW* then show '>'
    # we can simplify this to be the below statement
    show_greater_than_string = is_active == is_threshold_type_above
    environment_string = snuba_query.environment.name if snuba_query.environment else "All"
    aggregate = alert_rule.snuba_query.aggregate
    return {
        "link": absolute_uri(
            reverse(
                "sentry-metric-alert",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "incident_id": incident.identifier,
                },
            )
        ),
        "rule_link": absolute_uri(
            reverse(
                "sentry-alert-rule",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "project_slug": project.slug,
                    "alert_rule_id": trigger.alert_rule_id,
                },
            )
        ),
        "project_slug": project.slug,
        "incident_name": incident.title,
        "environment": environment_string,
        "time_window": format_duration(snuba_query.time_window / 60),
        "triggered_at": incident_trigger.date_added,
        "aggregate": aggregate,
        "query": snuba_query.query,
        "threshold": trigger.alert_threshold if is_active else alert_rule.resolve_threshold,
        # if alert threshold and threshold type is above then show '>'
        # if resolve threshold and threshold type is *BELOW* then show '>'
        "threshold_direction_string": ">" if show_greater_than_string else "<",
        "status": INCIDENT_STATUS[IncidentStatus(incident.status)],
        "status_key": INCIDENT_STATUS[IncidentStatus(incident.status)].lower(),
        "is_critical": incident.status == IncidentStatus.CRITICAL,
        "is_warning": incident.status == IncidentStatus.WARNING,
        "unsubscribe_link": None,
    }
