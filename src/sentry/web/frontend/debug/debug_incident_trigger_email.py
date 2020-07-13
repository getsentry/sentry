from __future__ import absolute_import, print_function

from django.views.generic import View

from sentry.models import Organization, Project
from sentry.snuba.models import SnubaQuery
from sentry.incidents.action_handlers import generate_incident_trigger_email_context
from sentry.incidents.models import (
    Incident,
    AlertRule,
    AlertRuleTrigger,
    TriggerStatus,
    IncidentStatus,
)


from .mail import MailPreview


class DebugIncidentTriggerEmailView(View):
    def get(self, request):
        organization = Organization(slug="myorg")
        project = Project(slug="myproject", organization=organization)

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

        context = generate_incident_trigger_email_context(
            project, incident, trigger, TriggerStatus.ACTIVE
        )

        return MailPreview(
            text_template=u"sentry/emails/incidents/trigger.txt",
            html_template=u"sentry/emails/incidents/trigger.html",
            context=context,
        ).render(request)
