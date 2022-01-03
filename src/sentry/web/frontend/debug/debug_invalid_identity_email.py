from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.tasks.commits import generate_invalid_identity_email
from social_auth.models import UserSocialAuth

from .mail import MailPreview


class DebugInvalidIdentityEmailView(View):
    def get(self, request: Request) -> Response:
        identity = UserSocialAuth(user=request.user, provider="dummy")

        email = generate_invalid_identity_email(identity=identity)
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
