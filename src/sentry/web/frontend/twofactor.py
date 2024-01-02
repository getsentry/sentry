import logging
import time
from base64 import b64encode

from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.request import Request

from sentry import options
from sentry import ratelimits as ratelimiter
from sentry.auth.authenticators.sms import SMSRateLimitExceeded
from sentry.auth.authenticators.u2f import U2fInterface
from sentry.models.authenticator import Authenticator
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.utils import auth, json
from sentry.utils.email import MessageBuilder
from sentry.utils.geo import geo_by_addr
from sentry.utils.http import absolute_uri
from sentry.web.forms.accounts import TwoFactorForm
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

COOKIE_NAME = "s2fai"
COOKIE_MAX_AGE = 60 * 60 * 24 * 31

logger = logging.getLogger(__name__)


@control_silo_view
class TwoFactorAuthView(BaseView):
    auth_required = False

    def perform_signin(self, request: Request, user, interface=None):
        assert auth.login(request, user, passed_2fa=True)
        rv = HttpResponseRedirect(auth.get_login_redirect(request))
        if interface is not None:
            interface.authenticator.mark_used()
            if not interface.is_backup_interface:
                rv.set_cookie(
                    COOKIE_NAME,
                    str(interface.type),
                    max_age=COOKIE_MAX_AGE,
                    path="/",
                )
        return rv

    def fail_signin(self, request: Request, user, form):
        # Ladies and gentlemen: the world's second-worst bruteforce prevention.
        time.sleep(2.0)
        form.errors["__all__"] = [_("Invalid confirmation code. Try again.")]

    def negotiate_interface(self, request: Request, interfaces):
        # If there is only one interface, just pick that one.
        if len(interfaces) == 1:
            return interfaces[0]

        # Next option is to go with the interface that was selected in the
        # URL.
        interface_id = request.GET.get("interface")
        if interface_id:
            for interface in interfaces:
                if interface.interface_id == interface_id:
                    return interface

        # Fallback case an interface was remembered in a cookie, go with that
        # one first.
        interface_type = request.COOKIES.get(COOKIE_NAME)
        if interface_type:
            for interface in interfaces:
                if str(interface.type) == interface_type:
                    return interface

        # Fallback is to go the highest ranked as default.  This will be
        # the most common path for first time users.
        return interfaces[0]

    def get_other_interfaces(self, selected, all):
        rv = []

        can_validate_otp = selected.can_validate_otp
        backup_interface = None

        for idx, interface in enumerate(all):
            if interface.interface_id == selected.interface_id:
                continue
            if idx == 0 or interface.requires_activation:
                rv.append(interface)
                if interface.can_validate_otp:
                    can_validate_otp = True
            if (
                backup_interface is None
                and interface.can_validate_otp
                and interface.is_backup_interface
            ):
                backup_interface = interface

        if not can_validate_otp and backup_interface is not None:
            rv.append(backup_interface)

        return rv

    def validate_otp(self, otp, selected_interface, all_interfaces=None):
        if selected_interface.validate_otp(otp):
            return selected_interface
        for interface in all_interfaces or ():
            if (
                interface.interface_id != selected_interface.interface_id
                and interface.is_backup_interface
                and interface.validate_otp(otp)
            ):
                return interface

    def send_notification_email(self, email, ip_address):
        context = {
            "datetime": timezone.now(),
            "email": email,
            "geo": geo_by_addr(ip_address),
            "ip_address": ip_address,
            "url": absolute_uri(reverse("sentry-account-settings-security")),
        }

        subject = "Suspicious Activity Detected"
        template = "mfa-too-many-attempts"
        msg = MessageBuilder(
            subject="{}{}".format(options.get("mail.subject-prefix"), subject),
            template=f"sentry/emails/{template}.txt",
            html_template=f"sentry/emails/{template}.html",
            type="user.mfa-too-many-attempts",
            context=context,
        )
        msg.send_async([email])

    def handle(self, request: Request) -> HttpResponse:
        user = auth.get_pending_2fa_user(request)
        if user is None:
            return HttpResponseRedirect(auth.get_login_url())

        interfaces = Authenticator.objects.all_interfaces_for_user(user)

        # If for whatever reason we ended up here but the user has no 2FA
        # enabled, we just continue successfully.
        if not interfaces:
            return self.perform_signin(request, user)

        challenge = activation = None
        interface = self.negotiate_interface(request, interfaces)

        is_rate_limited = ratelimiter.backend.is_limited(
            f"auth-2fa:user:{user.id}", limit=5, window=20
        ) or ratelimiter.backend.is_limited(
            f"auth-2fa-long:user:{user.id}", limit=20, window=60 * 60
        )

        if request.method == "POST" and is_rate_limited:
            # prevent spamming due to failed 2FA attempts
            if not ratelimiter.backend.is_limited(
                f"auth-2fa-failed-notification:user:{user.id}", limit=1, window=30 * 60
            ):
                self.send_notification_email(
                    email=user.username, ip_address=request.META["REMOTE_ADDR"]
                )

            return HttpResponse(
                "You have made too many 2FA attempts. Please try again later.",
                content_type="text/plain",
                status=429,
            )

        if request.method == "GET":
            try:
                activation = interface.activate(request)

                if activation is not None and activation.type == "challenge":
                    challenge = activation.challenge

                    if interface.type == U2fInterface.type:
                        activation.challenge = {}
                        activation.challenge["webAuthnAuthenticationData"] = b64encode(challenge)
            except SMSRateLimitExceeded as e:
                logger.warning(
                    "login.2fa.sms.rate-limited-exceeded",
                    extra={
                        "remote_ip": f"{e.remote_ip}",
                        "user_id": f"{e.user_id}",
                        "phone_number": f"{e.phone_number}",
                    },
                )
                return HttpResponse(
                    "You have made too many 2FA attempts. Please try again later.",
                    content_type="text/plain",
                    status=429,
                )

        elif "challenge" in request.POST:
            challenge = json.loads(request.POST["challenge"])
        form = TwoFactorForm()

        # If an OTP response was supplied, we try to make it pass.
        otp = request.POST.get("otp")
        if otp:
            used_interface = self.validate_otp(otp, interface, interfaces)
            if used_interface is not None:
                return self.perform_signin(request, user, used_interface)
            self.fail_signin(request, user, form)

        #  If a challenge and response exists, validate
        if challenge:
            response = request.POST.get("response")
            if response:
                response = json.loads(response)
                if interface.validate_response(request, challenge, response):
                    return self.perform_signin(request, user, interface)
                self.fail_signin(request, user, form)

        return render_to_response(
            ["sentry/twofactor_%s.html" % interface.interface_id, "sentry/twofactor.html"],
            {
                "form": form,
                "interface": interface,
                "other_interfaces": self.get_other_interfaces(interface, interfaces),
                "activation": activation,
            },
            request,
            status=200,
        )


@control_silo_function
def u2f_appid(request):
    facets = options.get("u2f.facets")
    if not facets:
        facets = [options.get("system.url-prefix")]
    return HttpResponse(
        json.dumps(
            {
                "trustedFacets": [
                    {"version": {"major": 1, "minor": 0}, "ids": [x.rstrip("/") for x in facets]}
                ]
            }
        ),
        content_type="application/fido.trusted-apps+json",
    )
