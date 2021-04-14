from django.views.generic import View

from sentry.incidents.models import Incident, IncidentActivity, IncidentActivityType
from sentry.incidents.tasks import generate_incident_activity_email
from sentry.models import User
from sentry.models.organization import Organization

from .mail import MailPreview


class DebugIncidentActivityEmailView(View):
    def get(self, request):
        organization = Organization(slug="myorg")
        user = User(id=1235, name="Hello There")
        incident = Incident(
            id=2, identifier=123, organization=organization, title="Something broke"
        )
        activity = IncidentActivity(
            incident=incident, user=user, type=IncidentActivityType.COMMENT.value, comment="hi"
        )
        email = generate_incident_activity_email(activity, user)
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
