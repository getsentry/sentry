from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.tasks.commits import generate_invalid_identity_email
from sentry.web.frontend.base import internal_region_silo_view
from social_auth.models import UserSocialAuth

from .mail import MailPreview


@internal_region_silo_view
class DebugInvalidIdentityEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        assert request.user.is_authenticated
        identity = UserSocialAuth(user_id=request.user.id, provider="dummy")

        email = generate_invalid_identity_email(identity=identity)
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
