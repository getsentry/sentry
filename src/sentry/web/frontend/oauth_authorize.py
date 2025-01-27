import logging
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from django.conf import settings
from django.db import IntegrityError, router, transaction
from django.http import HttpRequest
from django.http.response import HttpResponseBase
from django.utils import timezone
from django.utils.safestring import mark_safe
from rest_framework.request import Request

from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.web.frontend.auth_login import AuthLoginView

logger = logging.getLogger("sentry.api.oauth_authorize")


def _not_authenticated(request: HttpRequest) -> bool:
    # subtle indirection -- otherwise mypy infers `request.user: AnonymousUser`
    # and then complains about unreachable code (though `request.user` is mutated!)
    return not request.user.is_authenticated


class OAuthAuthorizeView(AuthLoginView):
    auth_required = False

    def get_next_uri(self, request: HttpRequest):
        return request.get_full_path()

    def redirect_response(self, response_type, redirect_uri, params):
        if response_type == "token":
            return self.redirect(
                "{}#{}".format(
                    redirect_uri,
                    urlencode([(k, v) for k, v in params.items() if v is not None]),
                )
            )

        parts = list(urlparse(redirect_uri))
        query = parse_qsl(parts[4])
        for key, value in params.items():
            if value is not None:
                query.append((key, value))
        parts[4] = urlencode(query)
        return self.redirect(urlunparse(parts))

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
        logging.error(
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

    def respond_login(self, request: Request, context, **kwargs):
        application = kwargs["application"]  # required argument
        context["banner"] = f"Connect Sentry to {application.name}"
        return self.respond("sentry/login.html", context)

    def get(self, request: Request, **kwargs) -> HttpResponseBase:
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

        if not redirect_uri:
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

        payload = {
            "rt": response_type,
            "cid": client_id,
            "ru": redirect_uri,
            "sc": scopes,
            "st": state,
            "uid": request.user.id if request.user.is_authenticated else "",
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
                        application=application,
                        scopes=scopes,
                        response_type=response_type,
                        redirect_uri=redirect_uri,
                        state=state,
                    )

        payload = {
            "rt": response_type,
            "cid": client_id,
            "ru": redirect_uri,
            "sc": scopes,
            "st": state,
            "uid": request.user.id,
        }
        request.session["oa2"] = payload

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
            organization_options = user_service.get_organizations(user_id=request.user.id)
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

    def post(self, request: Request, **kwargs) -> HttpResponseBase:
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

        if _not_authenticated(request):
            response = super().post(request, application=application, **kwargs)
            # once they login, bind their user ID
            if request.user.is_authenticated:
                request.session["oa2"]["uid"] = request.user.id
                request.session.modified = True
            return response

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

        op = request.POST.get("op")
        if op == "approve":
            return self.approve(
                request=request,
                application=application,
                scopes=scopes,
                response_type=response_type,
                redirect_uri=redirect_uri,
                state=payload["st"],
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

    def approve(self, request: HttpRequest, application, **params):
        # Some applications require org level access, so user who approves only gives
        # access to that organization by selecting one. If None, means the application
        # has user level access and will be able to have access to all the organizations of that user.
        selected_organization_id = request.POST.get("selected_organization_id")

        try:
            with transaction.atomic(router.db_for_write(ApiAuthorization)):
                ApiAuthorization.objects.create(
                    application=application,
                    user_id=request.user.id,
                    scope_list=params["scopes"],
                    organization_id=selected_organization_id,
                )
        except IntegrityError:
            if params["scopes"]:
                auth = ApiAuthorization.objects.get(
                    application=application,
                    user_id=request.user.id,
                    organization_id=selected_organization_id,
                )
                for scope in params["scopes"]:
                    if scope not in auth.scope_list:
                        auth.scope_list.append(scope)
                auth.save()

        metrics.incr(
            "oauth_authorize.get.approve",
            sample_rate=1.0,
            tags={
                "response_type": params["response_type"],
            },
        )

        if params["response_type"] == "code":
            grant = ApiGrant.objects.create(
                user_id=request.user.id,
                application=application,
                redirect_uri=params["redirect_uri"],
                scope_list=params["scopes"],
                organization_id=selected_organization_id,
            )
            logger.info(
                "approve.grant",
                extra={
                    "response_type": params["response_type"],
                    "redirect_uri": params["redirect_uri"],
                    "scope": params["scopes"],
                },
            )
            return self.redirect_response(
                params["response_type"],
                params["redirect_uri"],
                {"code": grant.code, "state": params["state"]},
            )
        elif params["response_type"] == "token":
            token = ApiToken.objects.create(
                application=application,
                user_id=request.user.id,
                refresh_token=None,
                scope_list=params["scopes"],
                scoping_organization_id=selected_organization_id,
            )

            logger.info(
                "approve.token",
                extra={
                    "response_type": params["response_type"],
                    "redirect_uri": params["redirect_uri"],
                    "scope": " ".join(token.get_scopes()),
                    "state": params["state"],
                },
            )

            return self.redirect_response(
                params["response_type"],
                params["redirect_uri"],
                {
                    "access_token": token.token,
                    "expires_in": int((timezone.now() - token.expires_at).total_seconds()),
                    "expires_at": token.expires_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "token_type": "bearer",
                    "scope": " ".join(token.get_scopes()),
                    "state": params["state"],
                },
            )
