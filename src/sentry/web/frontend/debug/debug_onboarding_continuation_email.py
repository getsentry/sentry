from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.api.endpoints.organization_onboarding_continuation_email import get_request_builder_args
from sentry.models.organization import Organization
from sentry.models.user import User
from sentry.web.frontend.debug.mail import MailPreviewAdapter
from sentry.web.helpers import render_to_response


class DebugOrganizationOnboardingContinuationEmail(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        platforms = request.GET.getlist("platforms", ["javascript", "python", "flutter"])
        org = Organization(id=1, name="My Company")
        user = User(name="Ben")
        preview = MailPreviewAdapter(**get_request_builder_args(user, org, platforms))

        return render_to_response("sentry/debug/mail/preview.html", {"preview": preview})
