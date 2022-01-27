from django.conf import settings
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.db import transaction
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.cache import never_cache
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.invite_helper import ApiInviteHelper, remove_invite_cookie
from sentry.auth.superuser import is_active_superuser
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.http import get_server_hostname
from sentry.models import AuthProvider, Organization, OrganizationMember, OrganizationStatus
from sentry.signals import join_request_link_viewed, user_signup
from sentry.utils import auth, json, metrics
from sentry.utils.auth import (
    get_login_redirect,
    has_user_registration,
    initiate_login,
    is_valid_redirect,
    login,
)
from sentry.utils.sdk import capture_exception
from sentry.utils.urls import add_params_to_url
from sentry.web.forms.accounts import AuthenticationForm, RegistrationForm
from sentry.web.frontend.base import BaseView

ERR_NO_SSO = _("The organization does not exist or does not have Single Sign-On enabled.")


# Stores callbacks that are called to get additional template context data before the login page
# is rendered. Callbacks are called in any order. If an error is encountered in a callback it is
# ignored. This works like HookStore in Javascript.
class AdditionalContext:
    def __init__(self):
        self._callbacks = set()

    def add_callback(self, callback):
        """callback should take a request object and return a dict of key-value pairs
        to add to the context."""
        self._callbacks.add(callback)

    def run_callbacks(self, request: Request):
        context = {}
        for cb in self._callbacks:
            try:
                result = cb(request)
                context.update(result)
            except Exception:
                capture_exception()
        return context


additional_context = AdditionalContext()


class AuthLoginView(BaseView):
    auth_required = False

    def get_auth_provider(self, organization_slug):
        try:
            organization = Organization.objects.get(
                slug=organization_slug, status=OrganizationStatus.VISIBLE
            )
        except Organization.DoesNotExist:
            return None

        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            return None

        return auth_provider

    def get_login_form(self, request: Request):
        op = request.POST.get("op")
        return AuthenticationForm(request, request.POST if op == "login" else None)

    def get_register_form(self, request: Request, initial=None):
        op = request.POST.get("op")
        return RegistrationForm(
            request.POST if op == "register" else None,
            initial=initial,
            # Custom auto_id to avoid ID collision with AuthenticationForm.
            auto_id="id_registration_%s",
        )

    def can_register(self, request: Request):
        return bool(has_user_registration() or request.session.get("can_register"))

    def get_join_request_link(self, organization):
        if not organization:
            return None

        if organization.get_option("sentry:join_requests") is False:
            return None

        join_request_link_viewed.send_robust(sender=self, organization=organization)

        return reverse("sentry-join-request", args=[organization.slug])

    def get_next_uri(self, request: Request):
        next_uri_fallback = None
        if request.session.get("_next") is not None:
            next_uri_fallback = request.session.pop("_next")
        return request.GET.get(REDIRECT_FIELD_NAME, next_uri_fallback)

    def get_post_register_url(self, request: Request):
        base_url = auth.get_login_redirect(request)
        params = {"frontend_events": json.dumps({"event_name": "Sign Up"})}
        return add_params_to_url(base_url, params)

    def respond_login(self, request: Request, context, **kwargs):
        return self.respond("sentry/login.html", context)

    def handle_basic_auth(self, request: Request, **kwargs):
        can_register = self.can_register(request)

        op = request.POST.get("op")
        organization = kwargs.pop("organization", None)

        if not op:
            # Detect that we are on the register page by url /register/ and
            # then activate the register tab by default.
            if "/register" in request.path_info and can_register:
                op = "register"
            elif request.GET.get("op") == "sso":
                op = "sso"

        login_form = self.get_login_form(request)
        if can_register:
            register_form = self.get_register_form(
                request, initial={"username": request.session.get("invite_email", "")}
            )
        else:
            register_form = None

        if can_register and register_form.is_valid():
            user = register_form.save()
            user.send_confirm_emails(is_new_user=True)
            user_signup.send_robust(
                sender=self, user=user, source="register-form", referrer="in-app"
            )

            # HACK: grab whatever the first backend is and assume it works
            user.backend = settings.AUTHENTICATION_BACKENDS[0]

            login(request, user, organization_id=organization.id if organization else None)

            # can_register should only allow a single registration
            request.session.pop("can_register", None)
            request.session.pop("invite_email", None)

            # Attempt to directly accept any pending invites
            invite_helper = ApiInviteHelper.from_cookie(request=request, instance=self)

            # In single org mode, associate the user to the only organization.
            #
            # XXX: Only do this if there isn't a pending invitation. The user
            # may need to configure 2FA in which case, we don't want to make
            # the association for them.
            if settings.SENTRY_SINGLE_ORGANIZATION and not invite_helper:
                organization = Organization.get_default()
                OrganizationMember.objects.create(
                    organization=organization, role=organization.default_role, user=user
                )

            if invite_helper and invite_helper.valid_request:
                invite_helper.accept_invite()
                response = self.redirect_to_org(request)
                remove_invite_cookie(request, response)

                return response

            return self.redirect(self.get_post_register_url(request))

        elif request.method == "POST":
            from sentry.app import ratelimiter
            from sentry.utils.hashlib import md5_text

            login_attempt = (
                op == "login" and request.POST.get("username") and request.POST.get("password")
            )

            if login_attempt and ratelimiter.is_limited(
                "auth:login:username:{}".format(
                    md5_text(login_form.clean_username(request.POST["username"])).hexdigest()
                ),
                limit=10,
                window=60,  # 10 per minute should be enough for anyone
            ):
                login_form.errors["__all__"] = [
                    "You have made too many login attempts. Please try again later."
                ]
                metrics.incr(
                    "login.attempt", instance="rate_limited", skip_internal=True, sample_rate=1.0
                )
            elif login_form.is_valid():
                user = login_form.get_user()

                login(request, user, organization_id=organization.id if organization else None)
                metrics.incr(
                    "login.attempt", instance="success", skip_internal=True, sample_rate=1.0
                )

                if not user.is_active:
                    return self.redirect(reverse("sentry-reactivate-account"))
                if organization:
                    if (
                        self._is_org_member(user, organization)
                        and request.user
                        and not is_active_superuser(request)
                    ):
                        auth.set_active_org(request, organization.slug)

                    if settings.SENTRY_SINGLE_ORGANIZATION:
                        try:
                            om = OrganizationMember.objects.get(
                                organization=organization, email=user.email
                            )
                            # XXX(jferge): if user is removed / invited but has an acct,
                            # pop _next so they aren't in infinite redirect on Single Org Mode
                        except OrganizationMember.DoesNotExist:
                            request.session.pop("_next", None)
                        else:
                            if om.user is None:
                                request.session.pop("_next", None)

                return self.redirect(get_login_redirect(request))
            else:
                metrics.incr(
                    "login.attempt", instance="failure", skip_internal=True, sample_rate=1.0
                )

        context = {
            "op": op or "login",
            "server_hostname": get_server_hostname(),
            "login_form": login_form,
            "organization": organization,
            "register_form": register_form,
            "CAN_REGISTER": can_register,
            "join_request_link": self.get_join_request_link(organization),
        }
        context.update(additional_context.run_callbacks(request))
        return self.respond_login(request, context, **kwargs)

    def handle_authenticated(self, request: Request):
        next_uri = self.get_next_uri(request)
        if is_valid_redirect(next_uri, allowed_hosts=(request.get_host(),)):
            return self.redirect(next_uri)
        return self.redirect_to_org(request)

    @never_cache
    @transaction.atomic
    def handle(self, request: Request, *args, **kwargs) -> Response:
        return super().handle(request, *args, **kwargs)

    # XXX(dcramer): OAuth provider hooks this view
    def get(self, request: Request, **kwargs) -> Response:
        next_uri = self.get_next_uri(request)
        if request.user.is_authenticated:
            # if the user is a superuser, but not 'superuser authenticated'
            # we allow them to re-authenticate to gain superuser status
            if not request.user.is_superuser or is_active_superuser(request):
                return self.handle_authenticated(request)

        request.session.set_test_cookie()

        # we always reset the state on GET so you don't end up at an odd location
        initiate_login(request, next_uri)

        # Single org mode -- send them to the org-specific handler
        if settings.SENTRY_SINGLE_ORGANIZATION:
            org = Organization.get_default()
            next_uri = reverse("sentry-auth-organization", args=[org.slug])
            return HttpResponseRedirect(next_uri)

        session_expired = "session_expired" in request.COOKIES
        if session_expired:
            messages.add_message(request, messages.WARNING, WARN_SESSION_EXPIRED)

        response = self.handle_basic_auth(request, **kwargs)

        if session_expired:
            response.delete_cookie("session_expired")

        return response

    # XXX(dcramer): OAuth provider hooks this view
    def post(self, request: Request, **kwargs) -> Response:
        op = request.POST.get("op")
        if op == "sso" and request.POST.get("organization"):
            auth_provider = self.get_auth_provider(request.POST["organization"])
            if auth_provider:
                next_uri = reverse("sentry-auth-organization", args=[request.POST["organization"]])
            else:
                next_uri = request.get_full_path()
                messages.add_message(request, messages.ERROR, ERR_NO_SSO)

            return HttpResponseRedirect(next_uri)

        return self.handle_basic_auth(request, **kwargs)
