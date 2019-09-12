from __future__ import absolute_import, print_function

from sentry.models import User
from django.views.generic import View

from sentry.incidents.models import Incident, IncidentActivity, IncidentActivityType
from sentry.models.organization import Organization
from sentry.incidents.tasks import generate_incident_activity_email

from .mail import MailPreview


class DebugIncidentActivityEmailView(View):
    def get(self, request):
        organization = Organization(slug="myorg")
        incident = Incident(identifier=123, organization=organization, title="Something broke")
        activity = IncidentActivity(
            incident=incident,
            user=User(name="Hello There"),
            type=IncidentActivityType.COMMENT.value,
            comment="hi",
        )
        email = generate_incident_activity_email(activity)
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
