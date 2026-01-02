from __future__ import annotations

import logging
import re
from typing import Any, Literal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from django.conf import settings
from django.db import IntegrityError, router, transaction
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.utils import timezone
from django.utils.safestring import mark_safe

from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.web.frontend.auth_login import AuthLoginView

logger = logging.getLogger("sentry.oauth")

# RFC 7636 §4.2: code_challenge is 43-128 unreserved characters (same format as verifier)
# ABNF: code-challenge = 43*128unreserved
# unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
CODE_CHALLENGE_REGEX = re.compile(r"^[A-Za-z0-9\-._~]{43,128}$")


class OAuthAuthorizeView(AuthLoginView):
    auth_required = False

    def get_next_uri(self, request: HttpRequest) -> str:
        return request.get_full_path()

    def redirect_response(self, response_type, redirect_uri, params):
        if response_type == "token":
            final_uri = "{}#{}".format(
                redirect_uri,
                urlencode([(k, v) for k, v in params.items() if v is not None]),
            )
        else:
            parts = list(urlparse(redirect_uri))
            query = parse_qsl(parts[4])
            for key, value in params.items():
                if value is not None:
                    query.append((key, value))
            parts[4] = urlencode(query)
            final_uri = urlunparse(parts)

        # Django's HttpResponseRedirect blocks custom URL schemes for security.
        # For OAuth redirects to Sentry Apple apps, we need to support the
        # sentry-apple:// scheme, so we use HttpResponse with a Location
        # header directly.
        parsed_uri = urlparse(final_uri)
        if parsed_uri.scheme == "sentry-apple":
            response = HttpResponse(status=302)
            response["Location"] = final_uri
            return response

        return self.redirect(final_uri)

    def error(
        self,
        request,
        response_type,
        redirect_uri,
        name,
        state=None,
        client_id=None,
        err_response=None,
    ):
        logger.error(
            "oauth.authorize-error",
            extra={
                "error_name": name,
                "response_type": response_type,
                "client_id": client_id,
                "redirect_uri": redirect_uri,
            },
        )
        if err_response:
            return self.respond(
                "sentry/oauth-error.html",
                {"error": mark_safe(f"Missing or invalid <em>{err_response}</em> parameter.")},
                status=400,
            )

        return self.redirect_response(response_type, redirect_uri, {"error": name, "state": state})

    def respond_login(self, request: HttpRequest, context, **kwargs):
        application = kwargs["application"]  # required argument
        context["banner"] = f"Connect Sentry to {application.name}"
        return self.respond("sentry/login.html", context)

    def get(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        response_type = request.GET.get("response_type")
        client_id = request.GET.get("client_id")
        redirect_uri = request.GET.get("redirect_uri")
        state = request.GET.get("state")
        force_prompt = request.GET.get("force_prompt")

        if not client_id:
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unauthorized_client",
                err_response="client_id",
            )

        try:
            application = ApiApplication.objects.get(
                client_id=client_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unauthorized_client",
                err_response="client_id",
            )

        # Spec references:
        #   - RFC 6749 §3.1.2.3 (Redirection Endpoint): redirect_uri must match a pre-registered value; if
        #     multiple redirect URIs are registered, the client MUST include redirect_uri in the request.
        #     https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3
        #   - RFC 8252 §8.4 (Native Apps): loopback redirect considerations (ephemeral ports).
        #     https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
        if not redirect_uri:
            # If multiple redirect URIs are registered, require the client to provide an
            # exact redirect_uri.
            # See RFC 6749 §3.1.2.3: https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3
            uris = application.get_redirect_uris()
            if len(uris) != 1:
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    err_response="redirect_uri",
                )
            redirect_uri = application.get_default_redirect_uri()
        elif not application.is_valid_redirect_uri(redirect_uri):
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="invalid_request",
                err_response="redirect_uri",
            )

        if not application.is_allowed_response_type(response_type):
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unsupported_response_type",
                err_response="client_id",
            )

        scopes_s = request.GET.get("scope")
        if scopes_s:
            scopes = scopes_s.split(" ")
        else:
            scopes = []
        if application.requires_org_level_access:
            # Applications that require org level access have a maximum scope limit set
            # in admin that should not pass
            max_scopes = application.scopes
            for scope in scopes:
                if scope not in max_scopes:
                    return self.error(
                        request=request,
                        client_id=client_id,
                        response_type=response_type,
                        redirect_uri=redirect_uri,
                        name="invalid_scope",
                        state=state,
                    )

        for scope in scopes:
            if scope not in settings.SENTRY_SCOPES:
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_scope",
                    state=state,
                )

        # PKCE support (RFC 7636): accept code_challenge and code_challenge_method.
        # This implementation only supports S256 method (plain method not supported for security).
        # Note: OAuth 2.1 requires S256 to be implemented; plain is still allowed in narrow cases.
        # Reference: https://datatracker.ietf.org/doc/html/rfc7636#section-4.2
        code_challenge = request.GET.get("code_challenge")
        code_challenge_method = request.GET.get("code_challenge_method")

        if code_challenge is not None:
            # Validate code_challenge format per RFC 7636 §4.2: 43-128 unreserved chars
            if not CODE_CHALLENGE_REGEX.match(code_challenge):
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

            # Require S256 method explicitly (plain method not supported for security)
            if code_challenge_method != "S256":
                logger.error(
                    "oauth.pkce.invalid-method",
                    extra={
                        "client_id": client_id,
                        "application_id": application.id if application else None,
                        "method": code_challenge_method,
                    },
                )
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

        payload = {
            "rt": response_type,
            "cid": client_id,
            "ru": redirect_uri,
            "sc": scopes,
            "st": state,
            "uid": request.user.id if request.user.is_authenticated else "",
            "cc": code_challenge,
            "ccm": code_challenge_method if code_challenge else None,
        }
        request.session["oa2"] = payload

        if not request.user.is_authenticated:
            return super().get(request, application=application)

        # If the application expects org level access, we need to prompt the user to choose which
        # organization they want to give access to every time. We should not presume the user intention
        if not (force_prompt or application.requires_org_level_access):
            try:
                existing_auth = ApiAuthorization.objects.get(
                    user_id=request.user.id, application=application
                )
            except ApiAuthorization.DoesNotExist:
                pass
            else:
                # if we've already approved all of the required scopes
                # we can skip prompting the user
                if all(existing_auth.has_scope(s) for s in scopes):
                    return self.approve(
                        request=request,
                        user=request.user,
                        application=application,
                        scopes=scopes,
                        response_type=response_type,
                        redirect_uri=redirect_uri,
                        state=state,
                        code_challenge=payload.get("cc"),
                        code_challenge_method=payload.get("ccm"),
                    )

        permissions = []
        if scopes:
            pending_scopes = set(scopes)
            matched_sets = set()
            for scope_set in settings.SENTRY_SCOPE_SETS:
                for scope, description in scope_set:
                    if scope_set in matched_sets and scope in pending_scopes:
                        pending_scopes.remove(scope)
                    elif scope in pending_scopes:
                        permissions.append(description)
                        matched_sets.add(scope_set)
                        pending_scopes.remove(scope)

            if pending_scopes:
                raise NotImplementedError(f"{pending_scopes} scopes did not have descriptions")

        if application.requires_org_level_access:
            organization_options = user_service.get_organizations(
                user_id=request.user.id, only_visible=True
            )
            if not organization_options:
                return self.respond(
                    "sentry/oauth-error.html",
                    {
                        "error": "This authorization flow is only available for users who are members of an organization."
                    },
                    status=400,
                )
        else:
            # If application is not org level we should not show organizations to choose from at all
            organization_options = []

        context = self.get_default_context(request) | {
            "user": request.user,
            "application": application,
            "scopes": scopes,
            "permissions": permissions,
            "organization_options": organization_options,
        }

        return self.respond("sentry/oauth-authorize.html", context)

    def _logged_out_post(
        self, request: HttpRequest, application: ApiApplication, **kwargs: Any
    ) -> HttpResponseBase:
        # subtle indirection to avoid "unreachable" after `.is_authenticated` below
        # since `.post()` mutates `request.user`
        response = super().post(request, application=application, **kwargs)
        # once they login, bind their user ID
        if request.user.is_authenticated:
            # Regenerate session to prevent session fixation attacks
            request.session.cycle_key()

            # Update OAuth payload with authenticated user ID for validation in post()
            request.session["oa2"]["uid"] = request.user.id
            request.session.modified = True
        return response

    def post(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        try:
            payload = request.session["oa2"]
        except KeyError:
            return self.respond(
                "sentry/oauth-error.html",
                {
                    "error": "We were unable to complete your request. Please re-initiate the authorization flow."
                },
            )

        try:
            application = ApiApplication.objects.get(
                client_id=payload["cid"], status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            return self.respond(
                "sentry/oauth-error.html",
                {"error": mark_safe("Missing or invalid <em>client_id</em> parameter.")},
            )

        if not request.user.is_authenticated:
            return self._logged_out_post(request, application, **kwargs)

        if payload["uid"] != request.user.id:
            return self.respond(
                "sentry/oauth-error.html",
                {
                    "error": "We were unable to complete your request. Please re-initiate the authorization flow."
                },
            )

        response_type = payload["rt"]
        redirect_uri = payload["ru"]
        scopes = payload["sc"]
        code_challenge = payload.get("cc")
        code_challenge_method = payload.get("ccm")

        op = request.POST.get("op")
        if op == "approve":
            return self.approve(
                request=request,
                user=request.user,
                application=application,
                scopes=scopes,
                response_type=response_type,
                redirect_uri=redirect_uri,
                state=payload["st"],
                code_challenge=code_challenge,
                code_challenge_method=code_challenge_method,
            )

        elif op == "deny":
            return self.error(
                request=request,
                client_id=payload["cid"],
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="access_denied",
                state=payload["st"],
            )
        else:
            raise NotImplementedError

    def approve(
        self,
        *,
        request: HttpRequest,
        user: User,
        application,
        scopes,
        response_type: Literal["code", "token"],
        redirect_uri,
        state,
        code_challenge=None,
        code_challenge_method=None,
    ) -> HttpResponseBase:
        # Some applications require org level access, so user who approves only gives
        # access to that organization by selecting one. If None, means the application
        # has user level access and will be able to have access to all the organizations of that user.
        selected_organization_id = request.POST.get("selected_organization_id")

        # Validate organization selection for org-level access applications
        # This prevents privilege escalation and ensures apps that require org-level
        # access always have an organization_id set
        if application.requires_org_level_access:
            # Organization ID is required for org-level access applications
            if not selected_organization_id:
                return self.error(
                    request=request,
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

            user_orgs = user_service.get_organizations(user_id=user.id, only_visible=True)
            org_ids = {org.id for org in user_orgs}

            try:
                selected_org_id_int = int(selected_organization_id)
            except (ValueError, TypeError):
                return self.error(
                    request=request,
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="unauthorized_client",
                    state=state,
                )

            if selected_org_id_int not in org_ids:
                return self.error(
                    request=request,
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="unauthorized_client",
                    state=state,
                )

        try:
            with transaction.atomic(router.db_for_write(ApiAuthorization)):
                ApiAuthorization.objects.create(
                    application=application,
                    user_id=user.id,
                    scope_list=scopes,
                    organization_id=selected_organization_id,
                )
        except IntegrityError:
            if scopes:
                auth = ApiAuthorization.objects.get(
                    application=application,
                    user_id=user.id,
                    organization_id=selected_organization_id,
                )
                for scope in scopes:
                    if scope not in auth.scope_list:
                        auth.scope_list.append(scope)
                auth.save()

        metrics.incr(
            "oauth_authorize.get.approve",
            sample_rate=1.0,
            tags={
                "response_type": response_type,
            },
        )

        if response_type == "code":
            grant = ApiGrant.objects.create(
                user_id=user.id,
                application=application,
                redirect_uri=redirect_uri,
                scope_list=scopes,
                organization_id=selected_organization_id,
                code_challenge=code_challenge,
                code_challenge_method=code_challenge_method,
            )
            logger.info(
                "approve.grant",
                extra={
                    "response_type": response_type,
                    "redirect_uri": redirect_uri,
                    "scope": scopes,
                },
            )
            return self.redirect_response(
                response_type,
                redirect_uri,
                {"code": grant.code, "state": state},
            )
        elif response_type == "token":
            token = ApiToken.objects.create(
                application=application,
                user_id=user.id,
                refresh_token=None,
                scope_list=scopes,
                scoping_organization_id=selected_organization_id,
            )

            logger.info(
                "approve.token",
                extra={
                    "response_type": response_type,
                    "redirect_uri": redirect_uri,
                    "scope": " ".join(token.get_scopes()),
                    "state": state,
                },
            )

            return self.redirect_response(
                response_type,
                redirect_uri,
                {
                    "access_token": token.token,
                    "expires_in": int((token.expires_at - timezone.now()).total_seconds()),
                    "expires_at": token.expires_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "token_type": "Bearer",
                    "scope": " ".join(token.get_scopes()),
                    "state": state,
                },
            )
        else:
            raise AssertionError(response_type)
