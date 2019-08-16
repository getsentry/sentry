from __future__ import absolute_import, print_function

from django.views.generic import View
from social_auth.models import UserSocialAuth

from sentry.tasks.commits import generate_invalid_identity_email

from .mail import MailPreview


class DebugInvalidIdentityEmailView(View):
    def get(self, request):
        identity = UserSocialAuth(user=request.user, provider="dummy")

        email = generate_invalid_identity_email(identity=identity)
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
