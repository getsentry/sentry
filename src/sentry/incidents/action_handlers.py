from __future__ import absolute_import

import abc

import six
from django.core.urlresolvers import reverse

from sentry.incidents.models import AlertRuleTriggerAction, QueryAggregations, TriggerStatus
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.linksign import generate_signed_link


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
            email_context["unsubscribe_link"] = self.generate_unsubscribe_link(user_id)
            self.build_message(email_context, status, user_id).send_async(to=[email])

    def build_message(self, context, status, user_id):
        context["unsubscribe_link"] = self.generate_unsubscribe_link(user_id)
        display = self.status_display[status]
        return MessageBuilder(
            subject=u"Incident Alert Rule {} for Project {}".format(display, self.project.slug),
            template=u"sentry/emails/incidents/trigger.txt",
            html_template=u"sentry/emails/incidents/trigger.html",
            type="incident.alert_rule_{}".format(display.lower()),
            context=context,
        )

    def generate_unsubscribe_link(self, user_id):
        return generate_signed_link(
            user_id,
            "sentry-account-email-unsubscribe-project",
            kwargs={"project_id": self.project.id},
        )

    def generate_email_context(self, status):
        trigger = self.action.alert_rule_trigger
        alert_rule = trigger.alert_rule
        return {
            "link": absolute_uri(
                reverse(
                    "sentry-incident",
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
                        "alert_rule_id": self.action.alert_rule_trigger.alert_rule_id,
                    },
                )
            ),
            "incident_name": self.incident.title,
            "aggregate": self.query_aggregations_display[QueryAggregations(alert_rule.aggregation)],
            "query": alert_rule.query,
            "threshold": trigger.alert_threshold
            if status == TriggerStatus.ACTIVE
            else trigger.resolve_threshold,
            "status": self.status_display[status],
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
