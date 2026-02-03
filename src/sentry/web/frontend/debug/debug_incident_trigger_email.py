from unittest import mock
from uuid import uuid4

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.action_handlers import generate_incident_trigger_email_context
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializer
from sentry.incidents.endpoints.serializers.incident import DetailedIncidentSerializer
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleTrigger
from sentry.incidents.models.incident import Incident, IncidentStatus, TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    OpenPeriodContext,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.models import SnubaQuery
from sentry.users.models.user import User
from sentry.web.frontend.base import internal_region_silo_view

from .mail import MailPreviewView


class MockedIncidentTrigger:
    date_added = timezone.now()


@internal_region_silo_view
class DebugIncidentTriggerEmailView(MailPreviewView):
    @mock.patch(
        "sentry.incidents.models.incident.IncidentTrigger.objects.get",
        return_value=MockedIncidentTrigger(),
    )
    @mock.patch(
        "sentry.users.models.user_option.UserOption.objects.get_value", return_value="US/Pacific"
    )
    def get_context(self, request, incident_trigger_mock, user_option_mock):
        organization = Organization(slug="myorg")
        project = Project(slug="myproject", organization=organization)
        user = User()

        query = SnubaQuery(
            time_window=60, query="transaction:/some/transaction", aggregate="count()"
        )
        alert_rule = AlertRule(id=1, organization=organization, name="My Alert", snuba_query=query)
        incident = Incident(
            id=2,
            identifier=123,
            organization=organization,
            title="Something broke",
            alert_rule=alert_rule,
            status=IncidentStatus.CRITICAL.value,
        )
        trigger = AlertRuleTrigger(alert_rule=alert_rule)

        alert_rule_serialized_response = serialize(alert_rule, None, AlertRuleSerializer())
        incident_serialized_response = serialize(incident, None, DetailedIncidentSerializer())

        return generate_incident_trigger_email_context(
            project=project,
            organization=organization,
            alert_rule_serialized_response=alert_rule_serialized_response,
            incident_serialized_response=incident_serialized_response,
            metric_issue_context=MetricIssueContext.from_legacy_models(
                incident=incident,
                new_status=IncidentStatus(incident.status),
            ),
            alert_context=AlertContext.from_alert_rule_incident(alert_rule),
            open_period_context=OpenPeriodContext.from_incident(incident),
            trigger_status=TriggerStatus.ACTIVE,
            trigger_threshold=trigger.alert_threshold,
            user=user,
            notification_uuid=str(uuid4()),
        )

    @property
    def html_template(self) -> str:
        return "sentry/emails/incidents/trigger.html"

    @property
    def text_template(self) -> str:
        return "sentry/emails/incidents/trigger.txt"
