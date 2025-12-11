import datetime

from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.security.emails import generate_security_email
from sentry.users.models.authenticator import Authenticator
from sentry.web.frontend.base import internal_region_silo_view

from .mail import MailPreview


@internal_region_silo_view
class DebugMfaRemovedEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        if isinstance(request.user, AnonymousUser):
            return HttpResponse(status=401)

        authenticator = Authenticator(id=0, type=3, user_id=request.user.id)  # u2f

        email = generate_security_email(
            account=request.user,
            actor=request.user,
            type="mfa-removed",
            ip_address=request.META["REMOTE_ADDR"],
            context={"authenticator": authenticator, "device_name": "Home computer"},
            # make this consistent for acceptance tests
            current_datetime=datetime.datetime(2017, 1, 20, 21, 39, 23, 30723),
        )
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
