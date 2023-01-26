from __future__ import annotations

import abc
import logging
from typing import Sequence, Set, Tuple

from django.conf import settings
from django.template.defaultfilters import pluralize
from django.urls import reverse

from sentry import features
from sentry.charts.types import ChartSize
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models import (
    INCIDENT_STATUS,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
    IncidentStatus,
    IncidentTrigger,
    TriggerStatus,
)
from sentry.models.notificationsetting import NotificationSetting
from sentry.models.options.user_option import UserOption
from sentry.models.user import User
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.email import MessageBuilder, get_email_addresses


class ActionHandler(metaclass=abc.ABCMeta):
    status_display = {TriggerStatus.ACTIVE: "Fired", TriggerStatus.RESOLVED: "Resolved"}

    def __init__(self, action, incident, project):
        self.action = action
        self.incident = incident
        self.project = project

    @abc.abstractmethod
    def fire(self, metric_value: int | float, new_status: IncidentStatus):
        pass

    @abc.abstractmethod
    def resolve(self, metric_value: int | float, new_status: IncidentStatus):
        pass


class DefaultActionHandler(ActionHandler):
    def fire(self, metric_value: int | float, new_status: IncidentStatus):
        self.send_alert(metric_value, new_status)

    def resolve(self, metric_value: int | float, new_status: IncidentStatus):
        self.send_alert(metric_value, new_status)

    @abc.abstractmethod
    def send_alert(self, metric_value: int | float, new_status: IncidentStatus):
        pass


@AlertRuleTriggerAction.register_type(
    "email",
    AlertRuleTriggerAction.Type.EMAIL,
    [AlertRuleTriggerAction.TargetType.USER, AlertRuleTriggerAction.TargetType.TEAM],
)
class EmailActionHandler(ActionHandler):
    def _get_targets(self) -> Set[int]:
        target = self.action.target
        if not target:
            return set()

        if self.action.target_type == AlertRuleTriggerAction.TargetType.USER.value:
            return {target.id}

        elif self.action.target_type == AlertRuleTriggerAction.TargetType.TEAM.value:
            users = NotificationSetting.objects.filter_to_accepting_recipients(
                self.project,
                {member.user for member in target.member_set},
            )[ExternalProviders.EMAIL]
            return {user.id for user in users}

        return set()

    def get_targets(self) -> Sequence[Tuple[int, str]]:
        return list(get_email_addresses(self._get_targets(), project=self.project).items())

    def fire(self, metric_value: int | float, new_status: IncidentStatus):
        self.email_users(TriggerStatus.ACTIVE, new_status)

    def resolve(self, metric_value: int | float, new_status: IncidentStatus):
        self.email_users(TriggerStatus.RESOLVED, new_status)

    def email_users(self, trigger_status: TriggerStatus, incident_status: IncidentStatus) -> None:
        for user_id, email in self.get_targets():
            user = User.objects.get_from_cache(id=user_id)
            email_context = generate_incident_trigger_email_context(
                self.project,
                self.incident,
                self.action.alert_rule_trigger,
                trigger_status,
                incident_status,
                user,
            )
            self.build_message(email_context, trigger_status, user_id).send_async(to=[email])

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
    def send_alert(self, metric_value: int | float, new_status: IncidentStatus):
        from sentry.integrations.slack.utils import send_incident_alert_notification

        send_incident_alert_notification(self.action, self.incident, metric_value, new_status)


@AlertRuleTriggerAction.register_type(
    "msteams",
    AlertRuleTriggerAction.Type.MSTEAMS,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="msteams",
)
class MsTeamsActionHandler(DefaultActionHandler):
    def send_alert(self, metric_value: int | float, new_status: IncidentStatus):
        from sentry.integrations.msteams.utils import send_incident_alert_notification

        send_incident_alert_notification(self.action, self.incident, metric_value, new_status)


@AlertRuleTriggerAction.register_type(
    "pagerduty",
    AlertRuleTriggerAction.Type.PAGERDUTY,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="pagerduty",
)
class PagerDutyActionHandler(DefaultActionHandler):
    def send_alert(self, metric_value: int | float, new_status: IncidentStatus):
        from sentry.integrations.pagerduty.utils import send_incident_alert_notification

        send_incident_alert_notification(self.action, self.incident, metric_value, new_status)


@AlertRuleTriggerAction.register_type(
    "sentry_app",
    AlertRuleTriggerAction.Type.SENTRY_APP,
    [AlertRuleTriggerAction.TargetType.SENTRY_APP],
)
class SentryAppActionHandler(DefaultActionHandler):
    def send_alert(self, metric_value: int | float, new_status: IncidentStatus):
        from sentry.rules.actions.notify_event_service import send_incident_alert_notification

        send_incident_alert_notification(self.action, self.incident, new_status, metric_value)


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


def generate_incident_trigger_email_context(
    project,
    incident,
    alert_rule_trigger,
    trigger_status,
    incident_status,
    user=None,
):
    trigger = alert_rule_trigger
    incident_trigger = IncidentTrigger.objects.get(incident=incident, alert_rule_trigger=trigger)

    alert_rule = trigger.alert_rule
    snuba_query = alert_rule.snuba_query
    is_active = trigger_status == TriggerStatus.ACTIVE
    is_threshold_type_above = alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value

    # if alert threshold and threshold type is above then show '>'
    # if resolve threshold and threshold type is *BELOW* then show '>'
    # we can simplify this to be the below statement
    show_greater_than_string = is_active == is_threshold_type_above
    environment_string = snuba_query.environment.name if snuba_query.environment else "All"

    aggregate = alert_rule.snuba_query.aggregate
    if CRASH_RATE_ALERT_AGGREGATE_ALIAS in aggregate:
        aggregate = aggregate.split(f"AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}")[0].strip()

    threshold = trigger.alert_threshold if is_active else alert_rule.resolve_threshold
    if threshold is None:
        # Setting this to trigger threshold because in the case of a resolve if no resolve
        # threshold is specified this will be None. Since we add a comparison sign to the
        # string it makes sense to set this to the trigger alert threshold if no threshold is
        # specified
        threshold = trigger.alert_threshold

    chart_url = None
    if features.has("organizations:metric-alert-chartcuterie", incident.organization):
        try:
            chart_url = build_metric_alert_chart(
                organization=incident.organization,
                alert_rule=incident.alert_rule,
                selected_incident=incident,
                size=ChartSize({"width": 600, "height": 200}),
            )
        except Exception:
            logging.exception("Error while attempting to build_metric_alert_chart")

    tz = settings.SENTRY_DEFAULT_TIME_ZONE
    if user is not None:
        user_option_tz = UserOption.objects.get_value(user=user, key="timezone")
        if user_option_tz is not None:
            tz = user_option_tz

    organization = incident.organization
    return {
        "link": organization.absolute_url(
            reverse(
                "sentry-metric-alert",
                kwargs={
                    "organization_slug": organization.slug,
                    "incident_id": incident.identifier,
                },
            ),
            query="referrer=alert_email",
        ),
        "rule_link": organization.absolute_url(
            reverse(
                "sentry-alert-rule",
                kwargs={
                    "organization_slug": organization.slug,
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
        "threshold": threshold,
        # if alert threshold and threshold type is above then show '>'
        # if resolve threshold and threshold type is *BELOW* then show '>'
        "threshold_direction_string": ">" if show_greater_than_string else "<",
        "status": INCIDENT_STATUS[incident_status],
        "status_key": INCIDENT_STATUS[incident_status].lower(),
        "is_critical": incident_status == IncidentStatus.CRITICAL,
        "is_warning": incident_status == IncidentStatus.WARNING,
        "unsubscribe_link": None,
        "chart_url": chart_url,
        "timezone": tz,
    }
