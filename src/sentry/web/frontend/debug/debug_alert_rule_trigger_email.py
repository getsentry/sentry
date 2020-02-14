from __future__ import absolute_import, print_function

from django.views.generic import View

from sentry.incidents.models import (
    Incident,
    AlertRule,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    TriggerStatus,
    IncidentStatus,
)
from sentry.models.project import Project
from sentry.models.organization import Organization
from sentry.incidents.action_handlers import EmailActionHandler

from .mail import MailPreview


class DebugAlertRuleTriggerEmailView(View):
    def get(self, request):
        organization = Organization(slug="myorg")
        project = Project(id=30, slug="myproj")

        incident = Incident(
            identifier=123,
            organization=organization,
            title="Something broke",
            status=IncidentStatus.CRITICAL,
        )
        alert_rule = AlertRule(
            id=1, organization=organization, aggregation=1, query="is:unresolved", time_window=60
        )
        alert_rule_trigger = AlertRuleTrigger(
            id=5, alert_rule=alert_rule, alert_threshold=100, resolve_threshold=50
        )
        action = AlertRuleTriggerAction(id=10, alert_rule_trigger=alert_rule_trigger)

        handler = EmailActionHandler(action, incident, project)
        email = handler.build_message(
            handler.generate_email_context(TriggerStatus.ACTIVE), TriggerStatus.ACTIVE, 1
        )
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
