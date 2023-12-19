from __future__ import annotations

import abc
import logging
from typing import List, Sequence, Set, Tuple
from urllib.parse import urlencode

from django.conf import settings
from django.template.defaultfilters import pluralize
from django.urls import reverse

from sentry import analytics, features
from sentry.charts.types import ChartSize
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models import (
    INCIDENT_STATUS,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
    IncidentStatus,
    TriggerStatus,
)
from sentry.models.rulesnooze import RuleSnooze
from sentry.models.user import User
from sentry.notifications.types import NotificationSettingEnum
from sentry.notifications.utils.participants import get_notification_recipients
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.services.hybrid_cloud.user_option import RpcUserOption, user_option_service
from sentry.snuba.metrics import format_mri_field, is_mri_field
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.email import MessageBuilder, get_email_addresses


class ActionHandler(metaclass=abc.ABCMeta):
    status_display = {TriggerStatus.ACTIVE: "Fired", TriggerStatus.RESOLVED: "Resolved"}
    provider: str

    def __init__(self, action, incident, project):
        self.action = action
        self.incident = incident
        self.project = project

    @abc.abstractmethod
    def fire(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        pass

    @abc.abstractmethod
    def resolve(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        pass

    def record_alert_sent_analytics(
        self, external_id: int | str | None = None, notification_uuid: str | None = None
    ):
        analytics.record(
            "alert.sent",
            organization_id=self.incident.organization_id,
            project_id=self.project.id,
            provider=self.provider,
            alert_id=self.incident.alert_rule_id,
            alert_type="metric_alert",
            external_id=str(external_id) if external_id is not None else "",
            notification_uuid=notification_uuid or "",
        )


class DefaultActionHandler(ActionHandler):
    def fire(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        if not RuleSnooze.objects.is_snoozed_for_all(alert_rule=self.incident.alert_rule):
            self.send_alert(metric_value, new_status, notification_uuid)

    def resolve(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        if not RuleSnooze.objects.is_snoozed_for_all(alert_rule=self.incident.alert_rule):
            self.send_alert(metric_value, new_status, notification_uuid)

    @abc.abstractmethod
    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        pass


@AlertRuleTriggerAction.register_type(
    "email",
    AlertRuleTriggerAction.Type.EMAIL,
    [AlertRuleTriggerAction.TargetType.USER, AlertRuleTriggerAction.TargetType.TEAM],
)
class EmailActionHandler(ActionHandler):
    provider = "email"

    def _get_targets(self) -> Set[int]:
        target = self.action.target
        if not target:
            return set()

        if RuleSnooze.objects.is_snoozed_for_all(alert_rule=self.incident.alert_rule):
            return set()

        if self.action.target_type == AlertRuleTriggerAction.TargetType.USER.value:
            if RuleSnooze.objects.is_snoozed_for_user(
                user_id=target.id, alert_rule=self.incident.alert_rule
            ):
                return set()

            return {target.id}

        elif self.action.target_type == AlertRuleTriggerAction.TargetType.TEAM.value:
            users = None
            out = get_notification_recipients(
                recipients=list(
                    RpcActor(id=member.user_id, actor_type=ActorType.USER)
                    for member in target.member_set
                ),
                type=NotificationSettingEnum.ISSUE_ALERTS,
                organization_id=self.project.organization_id,
                project_ids=[self.project.id],
                actor_type=ActorType.USER,
            )
            users = out[ExternalProviders.EMAIL]

            snoozed_users = RuleSnooze.objects.filter(
                alert_rule=self.incident.alert_rule, user_id__in=[user.id for user in users]
            ).values_list("user_id", flat=True)
            return {user.id for user in users if user.id not in snoozed_users}

        return set()

    def get_targets(self) -> Sequence[Tuple[int, str]]:
        return list(get_email_addresses(self._get_targets(), project=self.project).items())

    def fire(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        self.email_users(TriggerStatus.ACTIVE, new_status, notification_uuid)

    def resolve(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        self.email_users(TriggerStatus.RESOLVED, new_status, notification_uuid)

    def email_users(
        self,
        trigger_status: TriggerStatus,
        incident_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        targets = [(user_id, email) for user_id, email in self.get_targets()]
        users = user_service.get_many(filter={"user_ids": [user_id for user_id, _ in targets]})
        for index, (user_id, email) in enumerate(targets):
            user = users[index]
            email_context = generate_incident_trigger_email_context(
                self.project,
                self.incident,
                self.action.alert_rule_trigger,
                trigger_status,
                incident_status,
                user,
                notification_uuid,
            )
            self.build_message(email_context, trigger_status, user_id).send_async(to=[email])
            self.record_alert_sent_analytics(user_id, notification_uuid)

    def build_message(self, context, status, user_id) -> MessageBuilder:
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
    provider = "slack"

    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        from sentry.integrations.slack.utils import send_incident_alert_notification

        success = send_incident_alert_notification(
            self.action, self.incident, metric_value, new_status, notification_uuid
        )
        if success:
            self.record_alert_sent_analytics(self.action.target_identifier, notification_uuid)


@AlertRuleTriggerAction.register_type(
    "msteams",
    AlertRuleTriggerAction.Type.MSTEAMS,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="msteams",
)
class MsTeamsActionHandler(DefaultActionHandler):
    provider = "msteams"

    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        from sentry.integrations.msteams.utils import send_incident_alert_notification

        success = send_incident_alert_notification(
            self.action, self.incident, metric_value, new_status, notification_uuid
        )
        if success:
            self.record_alert_sent_analytics(self.action.target_identifier, notification_uuid)


@AlertRuleTriggerAction.register_type(
    "discord",
    AlertRuleTriggerAction.Type.DISCORD,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="discord",
)
class DiscordActionHandler(DefaultActionHandler):
    provider = "discord"

    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        from sentry.integrations.discord.actions.metric_alert import (
            send_incident_alert_notification,
        )

        success = send_incident_alert_notification(
            self.action, self.incident, metric_value, new_status
        )
        if success:
            self.record_alert_sent_analytics(self.action.target_identifier, notification_uuid)


@AlertRuleTriggerAction.register_type(
    "pagerduty",
    AlertRuleTriggerAction.Type.PAGERDUTY,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="pagerduty",
)
class PagerDutyActionHandler(DefaultActionHandler):
    provider = "pagerduty"

    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        from sentry.integrations.pagerduty.utils import send_incident_alert_notification

        success = send_incident_alert_notification(
            self.action, self.incident, metric_value, new_status, notification_uuid
        )
        if success:
            self.record_alert_sent_analytics(self.action.target_identifier, notification_uuid)


@AlertRuleTriggerAction.register_type(
    "opsgenie",
    AlertRuleTriggerAction.Type.OPSGENIE,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="opsgenie",
)
class OpsgenieActionHandler(DefaultActionHandler):
    provider = "opsgenie"

    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        from sentry.integrations.opsgenie.utils import send_incident_alert_notification

        success = send_incident_alert_notification(
            self.action, self.incident, metric_value, new_status, notification_uuid
        )
        if success:
            self.record_alert_sent_analytics(self.action.target_identifier, notification_uuid)


@AlertRuleTriggerAction.register_type(
    "sentry_app",
    AlertRuleTriggerAction.Type.SENTRY_APP,
    [AlertRuleTriggerAction.TargetType.SENTRY_APP],
)
class SentryAppActionHandler(DefaultActionHandler):
    provider = "sentry_app"

    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ):
        from sentry.rules.actions.notify_event_service import send_incident_alert_notification

        success = send_incident_alert_notification(
            self.action, self.incident, new_status, metric_value, notification_uuid
        )
        if success:
            self.record_alert_sent_analytics(self.action.sentry_app_id, notification_uuid)


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
    user: User | RpcUser | None = None,
    notification_uuid: str | None = None,
):
    trigger = alert_rule_trigger
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
    if is_mri_field(aggregate):
        aggregate = format_mri_field(aggregate)
    elif CRASH_RATE_ALERT_AGGREGATE_ALIAS in aggregate:
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
        options: List[RpcUserOption] = user_option_service.get_many(
            filter=dict(keys=["timezone"], user_ids=[user.id])
        )
        if options and options[0].value is not None:
            tz = options[0].value

    organization = incident.organization
    alert_link_params = {
        "referrer": "metric_alert_email",
    }
    if notification_uuid:
        alert_link_params["notification_uuid"] = notification_uuid

    alert_link = organization.absolute_url(
        reverse(
            "sentry-metric-alert",
            kwargs={
                "organization_slug": organization.slug,
                "incident_id": incident.identifier,
            },
        ),
        query=urlencode(alert_link_params),
    )

    snooze_alert_url = None
    snooze_alert = True
    snooze_alert_url = alert_link + "&" + urlencode({"mute": "1"})

    return {
        "link": alert_link,
        "project_slug": project.slug,
        "incident_name": incident.title,
        "environment": environment_string,
        "time_window": format_duration(snuba_query.time_window / 60),
        "triggered_at": incident.date_added,
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
        "snooze_alert": snooze_alert,
        "snooze_alert_url": snooze_alert_url,
    }
