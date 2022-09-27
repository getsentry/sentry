from unittest import mock

from django.utils import timezone

from sentry.incidents.action_handlers import generate_incident_trigger_email_context
from sentry.incidents.models import (
    AlertRule,
    AlertRuleTrigger,
    Incident,
    IncidentStatus,
    TriggerStatus,
)
from sentry.models import Organization, Project, User
from sentry.snuba.models import SnubaQuery

from .mail import MailPreviewView


class MockedIncidentTrigger:
    date_added = timezone.now()


class DebugIncidentTriggerEmailView(MailPreviewView):
    @mock.patch(
        "sentry.incidents.models.IncidentTrigger.objects.get", return_value=MockedIncidentTrigger()
    )
    @mock.patch("sentry.models.UserOption.objects.get_value", return_value="US/Pacific")
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
            status=IncidentStatus.CRITICAL,
        )
        trigger = AlertRuleTrigger(alert_rule=alert_rule)

        return generate_incident_trigger_email_context(
            project, incident, trigger, TriggerStatus.ACTIVE, IncidentStatus(incident.status), user
        )

    @property
    def html_template(self):
        return "sentry/emails/incidents/trigger.html"

    @property
    def text_template(self):
        return "sentry/emails/incidents/trigger.txt"
