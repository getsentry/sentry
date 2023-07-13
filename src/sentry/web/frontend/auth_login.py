from random import randint
from typing import Any, Optional, Union

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views.decorators.cache import never_cache
from rest_framework.request import Request

from sentry import features
from sentry.api.invite_helper import ApiInviteHelper, remove_invite_details_from_session
from sentry.api.utils import generate_organization_url
from sentry.auth.superuser import is_active_superuser
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.http import get_server_hostname
from sentry.models import AuthProvider, Organization, OrganizationStatus
from sentry.models.user import User
from sentry.services.hybrid_cloud import coerce_id_from
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.signals import join_request_link_viewed, user_signup
from sentry.utils import auth, json, metrics
from sentry.utils.auth import (
    get_login_redirect,
    has_user_registration,
    initiate_login,
    is_valid_redirect,
    login,
)
from sentry.utils.http import absolute_uri
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

    def add_callback(self, callback: Any) -> None:
        """callback should take a request object and return a dict of key-value pairs
        to add to the context."""
        self._callbacks.add(callback)

    def run_callbacks(self, request: Request) -> dict:
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

    @never_cache
    def handle(self, request: Request, *args, **kwargs) -> HttpResponse:
        return super().handle(request, *args, **kwargs)

    def get(self, request: Request, **kwargs) -> HttpResponse:
        next_uri = self.get_next_uri(request)
        if request.user.is_authenticated:
            return self.redirect_authenticated_user(request, next_uri=next_uri)

        request.session.set_test_cookie()

        # we always reset the state on GET so you don't end up at an odd location
        initiate_login(request, next_uri)

        # Single org mode -- send them to the org-specific handler
        if settings.SENTRY_SINGLE_ORGANIZATION:
            return self.redirect_to_org_specific_login()

        session_expired = "session_expired" in request.COOKIES
        if session_expired:
            messages.add_message(request, messages.WARNING, WARN_SESSION_EXPIRED)

        default_context = self.get_default_context(request=request)

        if self.requires_sso_login_redirect(request=request):
            response = self.get_sso_redirect(request=request)
        elif self.can_register(request):
            response = self.get_registration_page(
                request=request, context=default_context, **kwargs
            )
        else:
            response = self.get_login_page(request=request, context=default_context, **kwargs)

        if session_expired:
            response.delete_cookie("session_expired")

        return response

    def redirect_authenticated_user(self, request: Request, next_uri: str) -> HttpResponseRedirect:
        """If an authenticated user sends a GET request to AuthLoginView, we redirect them forwards in the auth process."""
        if is_valid_redirect(next_uri, allowed_hosts=(request.get_host(),)):
            return self.redirect(next_uri)
        return self.redirect_to_org(request)

    def redirect_to_org_specific_login(self) -> HttpResponseRedirect:
        """If Sentry is in single org mode this redirects users to their specific handler."""
        org = Organization.get_default()
        next_uri = reverse("sentry-auth-organization", args=[org.slug])
        return HttpResponseRedirect(next_uri)

    def requires_sso_login_redirect(self, request: Request) -> bool:
        non_sso_urls = [
            reverse("sentry-auth-organization", args=[request.subdomain]),
            reverse("sentry-register"),
        ]
        return (
            request.subdomain
            and self.check_if_org_exists(request)
            and request.path_info not in non_sso_urls
        )

    def get_sso_redirect(self, request: Request) -> HttpResponseRedirect:
        """Returns a redirect response that will take a user to SSO login."""
        url_prefix = generate_organization_url(request.subdomain)
        url = absolute_uri(
            reverse("sentry-auth-organization", args=[request.subdomain]), url_prefix=url_prefix
        )
        if request.GET:
            url = f"{url}?{request.GET.urlencode()}"
        return HttpResponseRedirect(url)

    def get_registration_page(self, request: Request, context: dict, **kwargs) -> HttpResponse:
        """Returns the standard registration page."""
        register_form = self.get_register_form(
            request, initial={"username": request.session.get("invite_email", "")}
        )
        context.update(
            {
                "op": "register",
                "CAN_REGISTER": True,
                "register_form": register_form,
            }
        )
        return self.respond_login(request, context, **kwargs)

    def get_login_page(self, request: Request, context: dict, **kwargs) -> HttpResponse:
        """Returns the standard login page."""
        op = "sso" if request.GET.get("op") == "sso" else "login"
        login_form = AuthenticationForm(request)
        context.update(
            {
                "op": op,
                "login_form": login_form,
            }
        )
        return self.respond_login(request, context, **kwargs)

    def post(self, request: Request, **kwargs) -> HttpResponse:
        op = request.POST.get("op")
        if op == "sso" and request.POST.get("organization"):
            return self.redirect_post_to_sso(request=request)

        default_context = self.get_default_context(request=request, **kwargs)
        organization = kwargs.pop("organization", None)

        if self.can_register(request):
            return self.handle_register_form_submit(
                request=request, context=default_context, organization=organization, **kwargs
            )
        else:
            return self.handle_login_form_submit(
                request=request, context=default_context, organization=organization
            )

    def redirect_post_to_sso(self, request: Request) -> HttpResponseRedirect:
        """If the post call comes from the SSO tab, redirect the user to SSO login next steps."""
        auth_provider = self.get_auth_providerif_exists(request.POST["organization"])
        if auth_provider:
            next_uri = reverse("sentry-auth-organization", args=[request.POST["organization"]])
        else:
            # Redirect to the org login route
            next_uri = request.get_full_path()
            messages.add_message(request, messages.ERROR, ERR_NO_SSO)

        return HttpResponseRedirect(next_uri)

    def get_auth_provider_if_exists(self, organization_slug: str) -> Union[AuthProvider, None]:
        """Returns the auth provider for the given org, or None if there isn't one."""
        try:
            organization = Organization.objects.get(
                slug=organization_slug, status=OrganizationStatus.ACTIVE
            )
        except Organization.DoesNotExist:
            return None

        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        except AuthProvider.DoesNotExist:
            return None

        return auth_provider

    def handle_register_form_submit(
        self, request: Request, context: dict, organization: Organization, **kwargs
    ) -> HttpResponse:
        """Validates a completed register form, redirecting to the next
        step or returning the form with its errors displayed."""

        register_form = self.get_register_form(
            request, initial={"username": request.session.get("invite_email", "")}
        )
        if register_form.is_valid():
            return self.redirect_to_next_register_step(
                request=request, register_form=register_form, organization=organization
            )
        else:

            context.update(
                {
                    "op": "register",
                    "register_form": register_form,
                    "CAN_REGISTER": True,
                }
            )
            return self.respond_login(request, context, **kwargs)

    def get_register_form(self, request: Request, initial: dict) -> RegistrationForm:
        """Extracts the register form from a request, then formats and returns it."""
        op = request.POST.get("op")
        return RegistrationForm(
            request.POST if op == "register" else None,
            initial=initial,
            # Custom auto_id to avoid ID collision with AuthenticationForm.
            auto_id="id_registration_%s",
        )

    def redirect_to_next_register_step(
        self, request: Request, register_form: RegistrationForm, organization: Organization
    ) -> HttpResponseRedirect:
        """Given a valid register form, redirects the user to their next step."""

        user = register_form.save()
        user.send_confirm_emails(is_new_user=True)
        user_signup.send_robust(sender=self, user=user, source="register-form", referrer="in-app")

        # HACK: grab whatever the first backend is and assume it works
        user.backend = settings.AUTHENTICATION_BACKENDS[0]
        self._handle_login(request, user, organization)

        # can_register should only allow a single registration
        request.session.pop("can_register", None)
        request.session.pop("invite_email", None)

        # Attempt to directly accept any pending invites
        invite_helper = ApiInviteHelper.from_session(
            request=request,
        )

        # In single org mode, associate the user to the only organization.
        #
        # XXX: Only do this if there isn't a pending invitation. The user
        # may need to configure 2FA in which case, we don't want to make
        # the association for them.
        if settings.SENTRY_SINGLE_ORGANIZATION and not invite_helper:
            self.add_user_to_organization(user)

        if invite_helper and invite_helper.valid_request:
            return self.accept_invite_and_redirect_to_org(
                request=request, invite_helper=invite_helper
            )

        return self.redirect(self.get_post_register_url(request))

    def add_user_to_organization(self, user: User) -> None:
        """Adds a user to their default organization as a member."""
        organization = Organization.get_default()
        organization_service.add_organization_member(
            organization_id=organization.id,
            default_org_role=organization.default_role,
            user_id=user.id,
        )

    def accept_invite_and_redirect_to_org(
        self, request: Request, invite_helper: ApiInviteHelper
    ) -> HttpResponseRedirect:
        """Accepts an invite on behalf of a user and redirects them to their org login"""
        invite_helper.accept_invite()
        organization_slug = invite_helper.invite_context.organization.slug
        self.determine_active_organization(request, organization_slug)
        response = self.redirect_to_org(request)
        remove_invite_details_from_session(request)
        return response

    def get_post_register_url(self, request: Request) -> str:
        """Gets the redirect URL for a successfully submitted register form."""
        base_url = auth.get_login_redirect(request)
        params = {"frontend_events": json.dumps({"event_name": "Sign Up"})}
        return add_params_to_url(base_url, params)

    def get_next_uri(self, request: Request) -> str:
        """Returns the next URI a user should visit in their authentication flow."""
        next_uri_fallback = None
        if request.session.get("_next") is not None:
            next_uri_fallback = request.session.pop("_next")
        return request.GET.get(REDIRECT_FIELD_NAME, next_uri_fallback)

    def handle_login_form_submit(self, request: Request, context: dict, **kwargs) -> HttpResponse:
        """Validates a completed login  form, redirecting to the next
        step or returning the form with its errors displayed."""
        op = request.POST.get("op")
        organization = kwargs.pop("organization", None)
        login_form = AuthenticationForm(request, request.POST if op == "login" else None)

        if self.is_ratelimited_login_attempt(request=request, login_form=login_form, op=op):
            return self.get_ratelimited_login_form(request, login_form, op, **kwargs)
        elif login_form.is_valid():
            return self.redirect_to_next_login_step(
                request=request, login_form=login_form, organization=organization
            )
        context.update({"login_form": login_form, "op": op or login})
        return self.respond_login(request, context, **kwargs)

    def is_ratelimited_login_attempt(
        self, request: Request, login_form: AuthenticationForm, op: str
    ) -> bool:
        """Returns true if a user is attempting to login but is currently ratelimited."""
        from sentry import ratelimits as ratelimiter
        from sentry.utils.hashlib import md5_text

        attempted_login = (
            op == "login" and request.POST.get("username") and request.POST.get("password")
        )

        return attempted_login and ratelimiter.is_limited(
            "auth:login:username:{}".format(
                md5_text(login_form.clean_username(request.POST["username"])).hexdigest()
            ),
            limit=5,
            window=60,  # 5 per minute should be enough for anyone
        )

    def get_ratelimited_login_form(
        self, request: Request, login_form: AuthenticationForm, op: str, **kwargs
    ) -> HttpResponse:
        """Returns a login form with ratelimited errors displayed."""
        login_form.errors["__all__"] = [
            "You have made too many login attempts. Please try again later."
        ]
        metrics.incr("login.attempt", instance="rate_limited", skip_internal=True, sample_rate=1.0)

        context = {
            "op": op or "login",
            "login_form": login_form,
        }

        context.update(additional_context.run_callbacks(request))
        return self.respond_login(request, context, **kwargs)

    def redirect_to_next_login_step(
        self,
        request: Request,
        login_form: AuthenticationForm,
        organization: Organization,
    ) -> HttpResponseRedirect:
        """Called when a user submits a valid login form and must be redirected to
        the next step in their auth process"""
        user = login_form.get_user()

        self._handle_login(request, user, organization)
        metrics.incr("login.attempt", instance="success", skip_internal=True, sample_rate=1.0)

        if not user.is_active:
            return self.redirect(reverse("sentry-reactivate-account"))
        if organization:
            self.refresh_organization_status(request, user, organization)
        # On login, redirect to onboarding
        if self.active_organization:
            if features.has(
                "organizations:customer-domains",
                self.active_organization.organization,
                actor=user,
            ):
                setattr(request, "subdomain", self.active_organization.organization.slug)
        return self.redirect(get_login_redirect(request))

    def _handle_login(
        self, request: Request, user: User, organization: Optional[Organization]
    ) -> None:
        """Logs a user in and determines their active org."""
        login(request, user, organization_id=coerce_id_from(organization))
        self.determine_active_organization(request)

    def refresh_organization_status(
        self, request: Request, user: User, organization: Organization
    ) -> None:
        """I'm not really sure what this does actually."""
        # Refresh the organization we fetched prior to login in order to check its login state.
        org_context = organization_service.get_organization_by_slug(
            user_id=request.user.id,
            slug=organization.slug,
            only_visible=False,
        )
        if org_context:
            if org_context.member and request.user and not is_active_superuser(request):
                auth.set_active_org(request, org_context.organization.slug)

            if settings.SENTRY_SINGLE_ORGANIZATION:
                om = organization_service.check_membership_by_email(
                    organization_id=org_context.organization.id, email=user.email
                )

                if om is None:
                    om = organization_service.check_membership_by_id(
                        organization_id=org_context.organization.id, user_id=user.id
                    )
                if om is None or om.user_id is None:
                    request.session.pop("_next", None)

    def check_if_org_exists(self, request: Request) -> bool:
        """Returns True iff the organization passed in a request exists."""
        return bool(
            organization_service.check_organization_by_slug(
                slug=request.subdomain, only_visible=True
            )
        )

    def can_register(self, request: Request) -> bool:
        """Returns True if a user is eligible to register.
        Users are eligible to register if they are arriving at this page via an invite link"""
        return bool(has_user_registration() or request.session.get("can_register"))

    def get_default_context(self, request: Request, **kwargs) -> dict:
        """Sets up a default context that will be injected into our login template."""
        organization = kwargs.pop("organization", None)
        default_context = {
            "server_hostname": get_server_hostname(),
            "login_form": None,
            "organization": kwargs.pop("organization", None),
            "register_form": None,
            "CAN_REGISTER": False,
            "join_request_link": self.get_join_request_link(organization),
            "show_login_banner": settings.SHOW_LOGIN_BANNER,
            "banner_choice": randint(0, 1),  # 2 possible banners
        }
        default_context.update(additional_context.run_callbacks(request))
        return default_context

    def get_join_request_link(self, organization: Organization) -> Union[str, None]:
        """Returns a join request link and does something else? I don't really know."""
        if not organization:
            return None

        if organization.get_option("sentry:join_requests") is False:
            return None

        join_request_link_viewed.send_robust(sender=self, organization=organization)

        return reverse("sentry-join-request", args=[organization.slug])

    def handle_basic_auth(
        self, request: Request, **kwargs
    ) -> Union[HttpResponse, HttpResponseRedirect]:
        """Legacy handler that handles GET and POST requests for registration and login.
        This is still here because it's used by OAuthAuthorizeView and AuthOrganizationLoginView.
        It will be removed once we decouple those classes from this method TODO(@EricHasegawa)
        """
        op = request.POST.get("op")
        organization = kwargs.pop("organization", None)

        org_exists = bool(
            organization_service.check_organization_by_slug(
                slug=request.subdomain, only_visible=True
            )
        )

        if request.method == "GET" and request.subdomain and org_exists:
            urls = [
                reverse("sentry-auth-organization", args=[request.subdomain]),
                reverse("sentry-register"),
            ]
            # Only redirect if the URL is not register or login paths.
            if request.path_info not in urls:
                url_prefix = generate_organization_url(request.subdomain)
                url = absolute_uri(urls[0], url_prefix=url_prefix)
                if request.GET:
                    url = f"{url}?{request.GET.urlencode()}"
                return HttpResponseRedirect(url)

        can_register = self.can_register(request)

        if not op:
            # Detect that we are on the register page by url /register/ and
            # then activate the register tab by default.
            if "/register" in request.path_info and can_register:
                op = "register"
            elif request.GET.get("op") == "sso":
                op = "sso"

        # login_form either validated on post or renders form fields for GET
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
            self._handle_login(request, user, organization)

            # can_register should only allow a single registration
            request.session.pop("can_register", None)
            request.session.pop("invite_email", None)

            # Attempt to directly accept any pending invites
            invite_helper = ApiInviteHelper.from_session(
                request=request,
            )

            # In single org mode, associate the user to the only organization.
            #
            # XXX: Only do this if there isn't a pending invitation. The user
            # may need to configure 2FA in which case, we don't want to make
            # the association for them.
            if settings.SENTRY_SINGLE_ORGANIZATION and not invite_helper:
                organization = Organization.get_default()
                organization_service.add_organization_member(
                    organization_id=organization.id,
                    default_org_role=organization.default_role,
                    user_id=user.id,
                )

            if invite_helper and invite_helper.valid_request:
                invite_helper.accept_invite()
                organization_slug = invite_helper.invite_context.organization.slug
                self.determine_active_organization(request, organization_slug)
                response = self.redirect_to_org(request)
                remove_invite_details_from_session(request)

                return response

            return self.redirect(self.get_post_register_url(request))

        elif request.method == "POST":
            from sentry import ratelimits as ratelimiter
            from sentry.utils.hashlib import md5_text

            login_attempt = (
                op == "login" and request.POST.get("username") and request.POST.get("password")
            )

            if login_attempt and ratelimiter.is_limited(
                "auth:login:username:{}".format(
                    md5_text(login_form.clean_username(request.POST["username"])).hexdigest()
                ),
                limit=5,
                window=60,  # 5 per minute should be enough for anyone
            ):
                login_form.errors["__all__"] = [
                    "You have made too many login attempts. Please try again later."
                ]
                metrics.incr(
                    "login.attempt", instance="rate_limited", skip_internal=True, sample_rate=1.0
                )
            elif login_form.is_valid():
                user = login_form.get_user()

                self._handle_login(request, user, organization)
                metrics.incr(
                    "login.attempt", instance="success", skip_internal=True, sample_rate=1.0
                )

                if not user.is_active:
                    return self.redirect(reverse("sentry-reactivate-account"))
                if organization:
                    # Refresh the organization we fetched prior to login in order to check its login state.
                    org_context = organization_service.get_organization_by_slug(
                        user_id=request.user.id,
                        slug=organization.slug,
                        only_visible=False,
                    )
                    if org_context:
                        if org_context.member and request.user and not is_active_superuser(request):
                            auth.set_active_org(request, org_context.organization.slug)

                        if settings.SENTRY_SINGLE_ORGANIZATION:
                            om = organization_service.check_membership_by_email(
                                organization_id=org_context.organization.id, email=user.email
                            )

                            if om is None:
                                om = organization_service.check_membership_by_id(
                                    organization_id=org_context.organization.id, user_id=user.id
                                )
                            if om is None or om.user_id is None:
                                request.session.pop("_next", None)

                # On login, redirect to onboarding
                if self.active_organization:
                    if features.has(
                        "organizations:customer-domains",
                        self.active_organization.organization,
                        actor=user,
                    ):
                        setattr(request, "subdomain", self.active_organization.organization.slug)
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
            "show_login_banner": settings.SHOW_LOGIN_BANNER,
            "banner_choice": randint(0, 1),  # 2 possible banners
        }

        context.update(additional_context.run_callbacks(request))
        return self.respond_login(request, context, **kwargs)

    def respond_login(self, context, **kwargs):
        """Finds and returns the login template -> useful because it's overloaded by subclasses."""
        return self.respond("sentry/login.html", context, **kwargs)

    def get_login_form(self, request: Request):
        """Legacy helper used by auth_organization_login"""
        op = request.POST.get("op")
        return AuthenticationForm(request, request.POST if op == "login" else None)
