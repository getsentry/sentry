import datetime

from django.views.generic import View

from sentry.security.emails import generate_security_email

from .mail import MailPreview


class DebugPasswordChangedEmailView(View):
    def get(self, request):
        email = generate_security_email(
            account=request.user,
            actor=request.user,
            type="password-changed",
            ip_address=request.META["REMOTE_ADDR"],
            # make this consistent for acceptance tests
            current_datetime=datetime.datetime(2017, 1, 20, 21, 39, 23, 30723),
        )
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
