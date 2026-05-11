from __future__ import annotations

import abc
import logging
from typing import Any
from urllib.parse import urlencode

import orjson
import sentry_sdk
from django.conf import settings
from django.template.defaultfilters import pluralize
from django.urls import reverse

from sentry import analytics, features
from sentry.analytics.events.alert_sent import AlertSentEvent
from sentry.charts.types import ChartSize
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.incident import DetailedIncidentSerializerResponse
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import INCIDENT_STATUS, IncidentStatus, TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    OpenPeriodContext,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.metrics import format_mri_field, is_mri_field
from sentry.snuba.utils import build_query_strings
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.users.services.user_option import RpcUserOption, user_option_service
from sentry.utils.email import MessageBuilder
from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
    DetectorSerializerResponse,
)
from sentry.workflow_engine.models.incident_groupopenperiod import IncidentGroupOpenPeriod

EMAIL_STATUS_DISPLAY = {TriggerStatus.ACTIVE: "Fired", TriggerStatus.RESOLVED: "Resolved"}


class ActionHandler(metaclass=abc.ABCMeta):
    @property
    @abc.abstractmethod
    def provider(self) -> str:
        raise NotImplementedError

    def record_alert_sent_analytics(
        self,
        organization_id: int,
        project_id: int,
        alert_id: int,
        external_id: int | str | None = None,
        notification_uuid: str | None = None,
    ) -> None:
        try:
            analytics.record(
                AlertSentEvent(
                    organization_id=organization_id,
                    project_id=project_id,
                    provider=self.provider,
                    alert_id=alert_id,
                    alert_type="metric_alert",
                    external_id=str(external_id) if external_id is not None else "",
                    notification_uuid=notification_uuid or "",
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)


class DefaultActionHandler(ActionHandler):
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


@AlertRuleTriggerAction.register_type(
    IntegrationProviderSlug.PAGERDUTY.value,
    AlertRuleTriggerAction.Type.PAGERDUTY,
    [AlertRuleTriggerAction.TargetType.SPECIFIC],
    integration_provider=IntegrationProviderSlug.PAGERDUTY.value,
)
class PagerDutyActionHandler(DefaultActionHandler):
    @property
    def provider(self) -> str:
        return IntegrationProviderSlug.PAGERDUTY.value


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


@AlertRuleTriggerAction.register_type(
    "sentry_app",
    AlertRuleTriggerAction.Type.SENTRY_APP,
    [AlertRuleTriggerAction.TargetType.SENTRY_APP],
)
class SentryAppActionHandler(DefaultActionHandler):
    @property
    def provider(self) -> str:
        return "sentry_app"


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
    project: Project,
    organization: Organization,
    alert_rule_serialized_response: AlertRuleSerializerResponse,
    incident_serialized_response: DetailedIncidentSerializerResponse,
    metric_issue_context: MetricIssueContext,
    alert_context: AlertContext,
    open_period_context: OpenPeriodContext,
    trigger_status: TriggerStatus,
    trigger_threshold: float | None,
    user: User | RpcUser | None = None,
    notification_uuid: str | None = None,
    detector_serialized_response: DetectorSerializerResponse | None = None,
) -> dict[str, Any]:
    from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType

    snuba_query = metric_issue_context.snuba_query
    is_active = trigger_status == TriggerStatus.ACTIVE
    is_threshold_type_above = (
        alert_context.threshold_type == AlertRuleThresholdType.ABOVE
        or alert_context.threshold_type == AnomalyDetectionThresholdType.ABOVE
    )
    subscription = metric_issue_context.subscription
    alert_link_params = {
        "referrer": "metric_alert_email",
    }
    # if alert threshold and threshold type is above then show '>'
    # if resolve threshold and threshold type is *BELOW* then show '>'
    # we can simplify this to be the below statement
    show_greater_than_string = is_active == is_threshold_type_above
    environment_string = snuba_query.environment.name if snuba_query.environment else "All"

    aggregate = snuba_query.aggregate
    if is_mri_field(aggregate):
        aggregate = format_mri_field(aggregate)
    elif CRASH_RATE_ALERT_AGGREGATE_ALIAS in aggregate:
        aggregate = aggregate.split(f"AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}")[0].strip()

    threshold: None | str | float = None
    if alert_context.detection_type == AlertRuleDetectionType.DYNAMIC:
        threshold_prefix_string = alert_context.detection_type.title()
        threshold = f"({alert_context.sensitivity} responsiveness)"
        alert_link_params["type"] = "anomaly_detection"
    else:
        threshold_prefix_string = ">" if show_greater_than_string else "<"
        threshold = trigger_threshold if is_active else alert_context.resolve_threshold
        if threshold is None:
            # Setting this to trigger threshold because in the case of a resolve if no resolve
            # threshold is specified this will be None. Since we add a comparison sign to the
            # string it makes sense to set this to the trigger alert threshold if no threshold is
            # specified
            threshold = trigger_threshold

    chart_url = None
    if features.has("organizations:metric-alert-chartcuterie", organization):
        try:
            chart_url = build_metric_alert_chart(
                organization=organization,
                alert_rule_serialized_response=alert_rule_serialized_response,
                selected_incident_serialized=incident_serialized_response,
                snuba_query=snuba_query,
                alert_context=alert_context,
                open_period_context=open_period_context,
                size=ChartSize({"width": 600, "height": 200}),
                subscription=subscription,
                detector_serialized_response=detector_serialized_response,
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

    if notification_uuid:
        alert_link_params["notification_uuid"] = notification_uuid

    # lookup the incident_id from the open_period_identifier
    try:
        incident_group_open_period = IncidentGroupOpenPeriod.objects.get(
            group_open_period_id=metric_issue_context.open_period_identifier
        )
        incident_identifier = incident_group_open_period.incident_identifier
    except IncidentGroupOpenPeriod.DoesNotExist:
        # the corresponding metric detector was not dual written
        incident_identifier = get_fake_id_from_object_id(
            metric_issue_context.open_period_identifier
        )

    alert_link = organization.absolute_url(
        reverse(
            "sentry-metric-alert",
            kwargs={
                "organization_slug": organization.slug,
                "incident_id": incident_identifier,
            },
        ),
        query=urlencode(alert_link_params),
    )
    # We don't have user muting for workflows in the new workflow engine system
    # so we don't need to show the snooze alert url
    snooze_alert_url = None
    snooze_alert = False

    query_str = build_query_strings(subscription=subscription, snuba_query=snuba_query).query_string
    return {
        "link": alert_link,
        "project_slug": project.slug,
        "incident_name": metric_issue_context.title,
        "environment": environment_string,
        "time_window": format_duration(snuba_query.time_window / 60),
        "triggered_at": open_period_context.date_started,
        "aggregate": aggregate,
        "query": query_str,
        "threshold": threshold,
        # if alert threshold and threshold type is above then show '>'
        # if resolve threshold and threshold type is *BELOW* then show '>'
        "threshold_prefix_string": threshold_prefix_string,
        "status": INCIDENT_STATUS[metric_issue_context.new_status],
        "status_key": INCIDENT_STATUS[metric_issue_context.new_status].lower(),
        "is_critical": metric_issue_context.new_status == IncidentStatus.CRITICAL,
        "is_warning": metric_issue_context.new_status == IncidentStatus.WARNING,
        "unsubscribe_link": None,
        "chart_url": chart_url,
        "timezone": tz,
        "snooze_alert": snooze_alert,
        "snooze_alert_url": snooze_alert_url,
    }


def build_message(context: dict[str, Any], status: TriggerStatus, user_id: int) -> MessageBuilder:
    display = EMAIL_STATUS_DISPLAY[status]

    return MessageBuilder(
        subject="[{}] {} - {}".format(
            context["status"], context["incident_name"], context["project_slug"]
        ),
        template="sentry/emails/incidents/trigger.txt",
        html_template="sentry/emails/incidents/trigger.html",
        type=f"incident.alert_rule_{display.lower()}",
        context=context,
        headers={"X-SMTPAPI": orjson.dumps({"category": "metric_alert_email"}).decode()},
    )


def email_users(
    metric_issue_context: MetricIssueContext,
    open_period_context: OpenPeriodContext,
    alert_context: AlertContext,
    alert_rule_serialized_response: AlertRuleSerializerResponse,
    incident_serialized_response: DetailedIncidentSerializerResponse,
    trigger_status: TriggerStatus,
    targets: list[tuple[int, str]],
    project: Project,
    notification_uuid: str | None = None,
    detector_serialized_response: DetectorSerializerResponse | None = None,
) -> list[int]:
    users = user_service.get_many_by_id(ids=[user_id for user_id, _ in targets])
    sent_to_users = []
    for index, (user_id, email) in enumerate(targets):
        user = users[index]
        # TODO(iamrajjoshi): Temporarily assert that alert_threshold is not None
        # This should be removed when we update the typing and fetch the trigger_threshold in the new system
        if trigger_status == TriggerStatus.ACTIVE:
            assert alert_context.alert_threshold is not None

        email_context = generate_incident_trigger_email_context(
            project=project,
            organization=project.organization,
            metric_issue_context=metric_issue_context,
            alert_rule_serialized_response=alert_rule_serialized_response,
            incident_serialized_response=incident_serialized_response,
            alert_context=alert_context,
            open_period_context=open_period_context,
            trigger_status=trigger_status,
            trigger_threshold=alert_context.alert_threshold,
            user=user,
            notification_uuid=notification_uuid,
            detector_serialized_response=detector_serialized_response,
        )
        build_message(email_context, trigger_status, user_id).send_async(to=[email])
        sent_to_users.append(user_id)

    return sent_to_users
