from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.endpoints.organization_onboarding_continuation_email import get_request_builder_args
from sentry.models import Organization, User
from sentry.web.frontend.debug.mail import MailPreviewAdapter
from sentry.web.helpers import render_to_response


class DebugOrganizationOnboardingContinuationEmail(View):
    def get(self, request: Request) -> Response:
        platforms = request.GET.getlist("platforms", ["javascript", "python", "flutter"])
        org = Organization(id=1, name="My Company")
        user = User(name="Ben", actor_id=1)
        preview = MailPreviewAdapter(**get_request_builder_args(user, org, platforms))

        return render_to_response("sentry/debug/mail/preview.html", {"preview": preview})
