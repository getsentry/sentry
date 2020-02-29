from __future__ import absolute_import

import abc

import six
from django.core.urlresolvers import reverse
from django.template.defaultfilters import pluralize

from sentry.incidents.models import (
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
    QueryAggregations,
    TriggerStatus,
    IncidentStatus,
)
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri


@six.add_metaclass(abc.ABCMeta)
class ActionHandler(object):
    status_display = {TriggerStatus.ACTIVE: "Fired", TriggerStatus.RESOLVED: "Resolved"}
    incident_status = {
        IncidentStatus.OPEN: "Open",
        IncidentStatus.CLOSED: "Resolved",
        IncidentStatus.CRITICAL: "Critical",
        IncidentStatus.WARNING: "Warning",
    }

    def __init__(self, action, incident, project):
        self.action = action
        self.incident = incident
        self.project = project

    @abc.abstractmethod
    def fire(self):
        pass

    @abc.abstractmethod
    def resolve(self):
        pass


@AlertRuleTriggerAction.register_type(
    "email",
    AlertRuleTriggerAction.Type.EMAIL,
    [AlertRuleTriggerAction.TargetType.USER, AlertRuleTriggerAction.TargetType.TEAM],
)
class EmailActionHandler(ActionHandler):
    query_aggregations_display = {
        QueryAggregations.TOTAL: "Total Events",
        QueryAggregations.UNIQUE_USERS: "Total Unique Users",
    }

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
                alert_settings = self.project.get_member_alert_settings("mail:alert")
                disabled_users = set(
                    user_id for user_id, setting in alert_settings.items() if setting == 0
                )
                if target.id not in disabled_users:
                    targets = [(target.id, target.email)]
            elif self.action.target_type == AlertRuleTriggerAction.TargetType.TEAM.value:
                targets = target.member_set.values_list("user_id", "user__email")
        # TODO: We need some sort of verification system to make sure we're not being
        # used as an email relay.
        # elif self.action.target_type == AlertRuleTriggerAction.TargetType.SPECIFIC.value:
        #     emails = [target]
        return targets

    def fire(self):
        self.email_users(TriggerStatus.ACTIVE)

    def resolve(self):
        self.email_users(TriggerStatus.RESOLVED)

    def email_users(self, status):
        email_context = self.generate_email_context(status)
        for user_id, email in self.get_targets():
            self.build_message(email_context, status, user_id).send_async(to=[email])

    def build_message(self, context, status, user_id):
        display = self.status_display[status]
        return MessageBuilder(
            subject=u"[{}] {} - {}".format(
                context["status"], context["incident_name"], self.project.slug
            ),
            template=u"sentry/emails/incidents/trigger.txt",
            html_template=u"sentry/emails/incidents/trigger.html",
            type="incident.alert_rule_{}".format(display.lower()),
            context=context,
        )

    def generate_email_context(self, status):
        trigger = self.action.alert_rule_trigger
        alert_rule = trigger.alert_rule
        is_active = status == TriggerStatus.ACTIVE
        is_threshold_type_above = trigger.threshold_type == AlertRuleThresholdType.ABOVE

        # if alert threshold and threshold type is above then show '>'
        # if resolve threshold and threshold type is *BELOW* then show '>'
        # we can simplify this to be the below statement
        show_greater_than_string = is_active == is_threshold_type_above
        environments = list(alert_rule.environment.all())
        environment_string = (
            ", ".join(sorted([env.name for env in environments])) if len(environments) else "All"
        )

        return {
            "link": absolute_uri(
                reverse(
                    "sentry-metric-alert",
                    kwargs={
                        "organization_slug": self.incident.organization.slug,
                        "incident_id": self.incident.identifier,
                    },
                )
            ),
            "rule_link": absolute_uri(
                reverse(
                    "sentry-alert-rule",
                    kwargs={
                        "organization_slug": self.incident.organization.slug,
                        "project_slug": self.project.slug,
                        "alert_rule_id": self.action.alert_rule_trigger.alert_rule_id,
                    },
                )
            ),
            "incident_name": self.incident.title,
            "environment": environment_string,
            "time_window": format_duration(alert_rule.time_window),
            "triggered_at": trigger.date_added,
            "aggregate": self.query_aggregations_display[QueryAggregations(alert_rule.aggregation)],
            "query": alert_rule.query,
            "threshold": trigger.alert_threshold if is_active else trigger.resolve_threshold,
            # if alert threshold and threshold type is above then show '>'
            # if resolve threshold and threshold type is *BELOW* then show '>'
            "threshold_direction_string": ">" if show_greater_than_string else "<",
            "status": self.incident_status[IncidentStatus(self.incident.status)],
            "is_critical": self.incident.status == IncidentStatus.CRITICAL,
            "is_warning": self.incident.status == IncidentStatus.WARNING,
            "unsubscribe_link": None,
        }


@AlertRuleTriggerAction.register_type(
    "slack",
    AlertRuleTriggerAction.Type.SLACK,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="slack",
)
class SlackActionHandler(ActionHandler):
    def fire(self):
        self.send_alert()

    def resolve(self):
        self.send_alert()

    def send_alert(self):
        from sentry.integrations.slack.utils import send_incident_alert_notification

        # TODO: We should include more information about the trigger/severity etc.
        send_incident_alert_notification(self.action, self.incident)


def format_duration(minutes):
    """
    Format minutes into a duration string
    """

    if minutes >= 1440:
        days = minutes / 1440
        return "{} day{}".format(days, pluralize(days))

    if minutes >= 60:
        hours = minutes / 60
        return "{} hour{}".format(hours, pluralize(hours))

    if minutes >= 1:
        return "{} minute{}".format(minutes, pluralize(minutes))

    seconds = minutes / 60
    return "{} second{}".format(seconds, pluralize(seconds))
