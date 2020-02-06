from __future__ import absolute_import

import abc

import six
from django.core.urlresolvers import reverse
from django.template.defaultfilters import pluralize

from sentry.incidents.models import (
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
            alert_settings = self.project.get_member_alert_settings("mail:alert")
            disabled_users = set(
                user_id for user_id, setting in alert_settings.items() if setting == 0
            )
            if self.action.target_type == AlertRuleTriggerAction.TargetType.USER.value:
                if target.id not in disabled_users:
                    targets = [(target.id, target.email)]
            elif self.action.target_type == AlertRuleTriggerAction.TargetType.TEAM.value:
                targets = target.member_set.values_list("user_id", "user__email")
                targets = [
                    (user_id, email) for user_id, email in targets if user_id not in disabled_users
                ]
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
            subject=u"Alert Rule {} for Project {}".format(display, self.project.slug),
            template=u"sentry/emails/incidents/trigger.txt",
            html_template=u"sentry/emails/incidents/trigger.html",
            type="incident.alert_rule_{}".format(display.lower()),
            context=context,
        )

    def generate_email_context(self, status):
        trigger = self.action.alert_rule_trigger
        alert_rule = trigger.alert_rule
        incident_status = {
            IncidentStatus.OPEN: "Open",
            IncidentStatus.CLOSED: "Resolved",
            IncidentStatus.CRITICAL: "Critical",
            IncidentStatus.WARNING: "Warning",
        }

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
            # TODO(alerts): Add environment
            "environment": "All",
            "time_window": format_duration(alert_rule.time_window),
            "triggered_at": trigger.date_added,
            "aggregate": self.query_aggregations_display[QueryAggregations(alert_rule.aggregation)],
            "query": alert_rule.query,
            "threshold": trigger.alert_threshold
            if status == TriggerStatus.ACTIVE
            else trigger.resolve_threshold,
            "status": incident_status[self.incident.status],
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
        send_incident_alert_notification(
            self.action.integration, self.incident, self.action.target_identifier
        )


def format_duration(seconds):
    """
    Format seconds into a duration string
    """

    if seconds >= 86400:
        days = seconds / 86400
        return "{} day{}".format(days, pluralize(days))

    if seconds >= 3600:
        hours = seconds / 3600
        return "{} hour{}".format(hours, pluralize(hours))

    if seconds >= 60:
        minutes = seconds / 60
        return "{} minute{}".format(minutes, pluralize(minutes))

    return "{} second{}".format(seconds, pluralize(seconds))
