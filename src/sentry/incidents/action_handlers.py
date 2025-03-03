from __future__ import annotations

import abc
import logging
from collections.abc import Sequence
from typing import Any
from urllib.parse import urlencode

import orjson
from django.conf import settings
from django.template.defaultfilters import pluralize
from django.urls import reverse

from sentry import analytics, features
from sentry.charts.types import ChartSize
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import (
    INCIDENT_STATUS,
    Incident,
    IncidentStatus,
    TriggerStatus,
)
from sentry.integrations.types import ExternalProviders
from sentry.models.project import Project
from sentry.models.rulesnooze import RuleSnooze
from sentry.models.team import Team
from sentry.notifications.types import NotificationSettingEnum
from sentry.notifications.utils.participants import get_notification_recipients
from sentry.snuba.metrics import format_mri_field, is_mri_field
from sentry.snuba.utils import build_query_strings
from sentry.types.actor import Actor, ActorType
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.users.services.user_option import RpcUserOption, user_option_service
from sentry.utils.email import MessageBuilder, get_email_addresses


class ActionHandler(metaclass=abc.ABCMeta):
    status_display = {TriggerStatus.ACTIVE: "Fired", TriggerStatus.RESOLVED: "Resolved"}

    @property
    @abc.abstractmethod
    def provider(self) -> str:
        raise NotImplementedError

    def __init__(
        self,
        action: AlertRuleTriggerAction,
        incident: Incident,
        project: Project,
    ) -> None:
        self.action = action
        self.incident = incident
        self.project = project

    @abc.abstractmethod
    def fire(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        pass

    @abc.abstractmethod
    def resolve(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        pass

    def record_alert_sent_analytics(
        self, external_id: int | str | None = None, notification_uuid: str | None = None
    ) -> None:
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
    ) -> None:
        if not RuleSnooze.objects.is_snoozed_for_all(alert_rule=self.incident.alert_rule):
            self.send_alert(metric_value, new_status, notification_uuid)

    def resolve(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        if not RuleSnooze.objects.is_snoozed_for_all(alert_rule=self.incident.alert_rule):
            self.send_alert(metric_value, new_status, notification_uuid)

    @abc.abstractmethod
    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        pass


@AlertRuleTriggerAction.register_type(
    "email",
    AlertRuleTriggerAction.Type.EMAIL,
    [AlertRuleTriggerAction.TargetType.USER, AlertRuleTriggerAction.TargetType.TEAM],
)
class EmailActionHandler(ActionHandler):
    @property
    def provider(self) -> str:
        return "email"

    def _get_targets(self) -> set[int]:
        target = self.action.target
        if not target:
            return set()

        if RuleSnooze.objects.is_snoozed_for_all(alert_rule=self.incident.alert_rule):
            return set()

        if self.action.target_type == AlertRuleTriggerAction.TargetType.USER.value:
            assert isinstance(target, RpcUser)
            if RuleSnooze.objects.is_snoozed_for_user(
                user_id=target.id, alert_rule=self.incident.alert_rule
            ):
                return set()

            return {target.id}

        elif self.action.target_type == AlertRuleTriggerAction.TargetType.TEAM.value:
            assert isinstance(target, Team)
            out = get_notification_recipients(
                recipients=list(
                    Actor(id=member.user_id, actor_type=ActorType.USER)
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

    def get_targets(self) -> Sequence[tuple[int, str]]:
        return list(get_email_addresses(self._get_targets(), project=self.project).items())

    def fire(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        self.email_users(
            trigger_status=TriggerStatus.ACTIVE,
            incident_status=new_status,
            notification_uuid=notification_uuid,
        )

    def resolve(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        self.email_users(
            trigger_status=TriggerStatus.RESOLVED,
            incident_status=new_status,
            notification_uuid=notification_uuid,
        )

    def email_users(
        self,
        trigger_status: TriggerStatus,
        incident_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        targets = [(user_id, email) for user_id, email in self.get_targets()]
        users = user_service.get_many_by_id(ids=[user_id for user_id, _ in targets])
        for index, (user_id, email) in enumerate(targets):
            user = users[index]
            email_context = generate_incident_trigger_email_context(
                project=self.project,
                incident=self.incident,
                alert_rule_trigger=self.action.alert_rule_trigger,
                trigger_status=trigger_status,
                incident_status=incident_status,
                user=user,
                notification_uuid=notification_uuid,
            )
            self.build_message(email_context, trigger_status, user_id).send_async(to=[email])
            self.record_alert_sent_analytics(user_id, notification_uuid)

    def build_message(
        self, context: dict[str, Any], status: TriggerStatus, user_id: int
    ) -> MessageBuilder:
        display = self.status_display[status]

        return MessageBuilder(
            subject="[{}] {} - {}".format(
                context["status"], context["incident_name"], self.project.slug
            ),
            template="sentry/emails/incidents/trigger.txt",
            html_template="sentry/emails/incidents/trigger.html",
            type=f"incident.alert_rule_{display.lower()}",
            context=context,
            headers={"X-SMTPAPI": orjson.dumps({"category": "metric_alert_email"}).decode()},
        )


@AlertRuleTriggerAction.register_type(
    "pagerduty",
    AlertRuleTriggerAction.Type.PAGERDUTY,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider="pagerduty",
)
class PagerDutyActionHandler(DefaultActionHandler):
    @property
    def provider(self) -> str:
        return "pagerduty"

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
    @property
    def provider(self) -> str:
        return "opsgenie"

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
    @property
    def provider(self) -> str:
        return "sentry_app"

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
    incident: Incident,
    alert_rule_trigger: AlertRuleTrigger,
    trigger_status: TriggerStatus,
    incident_status: IncidentStatus,
    user: User | RpcUser | None = None,
    notification_uuid: str | None = None,
):
    trigger = alert_rule_trigger
    alert_rule = trigger.alert_rule
    snuba_query = alert_rule.snuba_query
    is_active = trigger_status == TriggerStatus.ACTIVE
    is_threshold_type_above = alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
    subscription = incident.subscription
    alert_link_params = {
        "referrer": "metric_alert_email",
    }
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

    threshold: None | str | float = None
    if alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC:
        threshold_prefix_string = alert_rule.detection_type.title()
        threshold = f"({alert_rule.sensitivity} responsiveness)"
        alert_link_params["type"] = "anomaly_detection"
    else:
        threshold_prefix_string = ">" if show_greater_than_string else "<"
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
                subscription=subscription,
            )
        except Exception:
            logging.exception("Error while attempting to build_metric_alert_chart")

    tz = settings.SENTRY_DEFAULT_TIME_ZONE
    if user is not None:
        options: list[RpcUserOption] = user_option_service.get_many(
            filter=dict(keys=["timezone"], user_ids=[user.id])
        )
        if options and options[0].value is not None:
            tz = options[0].value

    organization = incident.organization
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

    query_str = build_query_strings(subscription=subscription, snuba_query=snuba_query).query_string
    return {
        "link": alert_link,
        "project_slug": project.slug,
        "incident_name": incident.title,
        "environment": environment_string,
        "time_window": format_duration(snuba_query.time_window / 60),
        "triggered_at": incident.date_added,
        "aggregate": aggregate,
        "query": query_str,
        "threshold": threshold,
        # if alert threshold and threshold type is above then show '>'
        # if resolve threshold and threshold type is *BELOW* then show '>'
        "threshold_prefix_string": threshold_prefix_string,
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
