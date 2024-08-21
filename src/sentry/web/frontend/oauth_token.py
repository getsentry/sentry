import logging
import secrets

import jwt
import requests
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View
from rest_framework.request import Request

from sentry import options
from sentry.mediators.token_exchange.util import GrantTypes
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.models.organization import Organization
from sentry.utils import json, metrics
from sentry.web.frontend.base import control_silo_view
from sentry.web.frontend.openidtoken import OpenIDToken

logger = logging.getLogger("sentry.api.oauth_token")


@control_silo_view
class OAuthTokenView(View):
    @csrf_exempt
    @method_decorator(never_cache)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    # Note: the reason parameter is for internal use only
    def error(self, request: HttpRequest, name, reason=None, status=400):
        client_id = request.POST.get("client_id")
        redirect_uri = request.POST.get("redirect_uri")

        logging.error(
            "oauth.token-error",
            extra={
                "error_name": name,
                "status": status,
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "reason": reason,
            },
        )
        return HttpResponse(
            json.dumps({"error": name}), content_type="application/json", status=status
        )

    def _get_rsa_key(self, jwks, kid):
        for key in jwks["keys"]:
            if key["kid"] == kid:
                return {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
        return None

    def _validate_id_token(self, request: HttpRequest):
        grant_type = request.POST.get("grant_type")
        if grant_type != GrantTypes.TOKEN_EXCHANGE:
            raise NotImplementedError

        id_token = request.POST.get("subject_token")
        if not id_token:
            # return error matching RFC requirements https://www.rfc-editor.org/rfc/rfc6749#section-5.2
            return HttpResponse(
                json.dumps(
                    {
                        "error": "invalid_request",
                        "error_description": "missing id token",
                    }
                ),
                status=400,
            )

        # TODO make this configurable for other CI providers eventually
        github_actions_issuer = "https://token.actions.githubusercontent.com"
        github_actions_jwks_url = "https://token.actions.githubusercontent.com/.well-known/jwks"

        # TODO validate audience
        expected_audience = options.get("system.url-prefix")

        try:
            response = requests.get(github_actions_jwks_url)
            response.raise_for_status()
            jwks = response.json()

            unverified_header = jwt.get_unverified_header(id_token)
            rsa_key = self._get_rsa_key(jwks, unverified_header["kid"])

            if rsa_key:
                # TODO: validate org/repository claims too!
                return jwt.decode(
                    id_token,
                    rsa_key,
                    audience=expected_audience,
                    issuer=github_actions_issuer,
                    algorithms=["RS256"],
                )
            else:
                return HttpResponseBadRequest(
                    json.dumps(
                        {
                            "error": "invalid_request",
                            "error_description": "id token signed with invalid key",
                        }
                    ),
                    content_type="application/json",
                )
        except requests.exception.RequestException as e:
            logger.exception("failed to fetch JWKS")
            return None
        except jwt.exceptions.InvalidTokenError as e:
            logger.exception(f"invalid id token: {e}")
            return None

    def _get_organization_from_resource(self, request: HttpRequest) -> Organization | None:
        organization_resource = request.POST.get("resource")

        # TODO: use stronger validation here with regex that ensures the organization ID is all numbers
        if not organization_resource.startswith(
            f'{options.get("system.url-prefix")}/api/0/organizations/'
        ):
            return HttpResponseBadRequest(
                json.dumps(
                    {
                        "error": "invalid_target",
                        "error_description": "resource target must be an organization",
                    }
                ),
                content_type="application/json",
            )

        # TODO: handle more edge cases (ie. what happens if we end the resource string with a '/')
        organization_id = organization_resource.rsplit("/", 1)

        # return a Organization object?
        if organization_id.isnumeric():
            try:
                organization = Organization.objects.get(id=organization_id[1])
                return organization
            except Organization.DoesNotExist:
                return HttpResponseBadRequest(json.dumps({"error": "invalid_target"}))

        return None

    def _create_org_auth_token(self, organization: Organization):
        # copied from src/sentry/api/endpoints/org_auth_tokens.py

        from django.core.exceptions import ValidationError
        from rest_framework import status
        from rest_framework.response import Response

        from sentry.api.utils import generate_region_url
        from sentry.models.organizationmapping import OrganizationMapping
        from sentry.models.orgauthtoken import MAX_NAME_LENGTH, OrgAuthToken
        from sentry.utils.security.orgauthtoken_token import (
            SystemUrlPrefixMissingException,
            generate_token,
            hash_token,
        )

        try:
            org_mapping = OrganizationMapping.objects.get(organization_id=organization.id)
            token_str = generate_token(
                organization.slug, generate_region_url(region_name=org_mapping.region_name)
            )
        except SystemUrlPrefixMissingException:
            return Response(
                {
                    "detail": {
                        "message": "system.url-prefix is not set. You need to set this to generate a token.",
                        "code": "missing_system_url_prefix",
                    }
                },
                status=400,
            )

        token_hashed = hash_token(token_str)

        name = f"generated by github actions {secrets.token_hex(4)}"

        # Main validation cases with specific error messages
        if not name:
            return Response({"detail": "The name cannot be blank."}, status=400)

        if len(name) > MAX_NAME_LENGTH:
            return Response(
                {"detail": "The name cannot be longer than 255 characters."}, status=400
            )

        token = OrgAuthToken.objects.create(
            name=name,
            organization_id=organization.id,
            scope_list=["org:ci"],
            token_last_characters=token_str[-4:],
            token_hashed=token_hashed,
        )

        try:
            token.full_clean()
        except ValidationError as e:
            return Response({"detail": list(e.messages)}, status=400)

        # https://www.rfc-editor.org/rfc/rfc8693.html#name-successful-response
        response_data = {
            "access_token": token_str,
            "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "token_type": "bearer",
            "scope": "org:ci",
        }

        return response_data

    @method_decorator(never_cache)
    def post(self, request: HttpRequest) -> HttpResponse:
        grant_type = request.POST.get("grant_type")
        client_id = request.POST.get("client_id")
        client_secret = request.POST.get("client_secret")

        metrics.incr(
            "oauth_token.post.start",
            sample_rate=1.0,
            tags={
                "client_id_exists": bool(client_id),
                "client_secret_exists": bool(client_secret),
            },
        )

        if grant_type == GrantTypes.TOKEN_EXCHANGE:
            id_token = self._validate_id_token(request)

            if id_token:
                organization = self._get_organization_from_resource(request)
                gha_oidc_config = organization.get_option("sentry:github_action_oidc")

                # check that the organization is what we expect
                if gha_oidc_config["organization"] != id_token["repository_owner"]:
                    return HttpResponse(status=401)
                else:
                    org_auth_token_data = self._create_org_auth_token(organization)
                    return HttpResponse(
                        json.dumps(org_auth_token_data), content_type="application/json", status=200
                    )
            else:
                return HttpResponseBadRequest()

        if not client_id:
            return self.error(request=request, name="missing_client_id", reason="missing client_id")
        if not client_secret:
            return self.error(
                request=request, name="missing_client_secret", reason="missing client_secret"
            )

        if grant_type not in [GrantTypes.AUTHORIZATION, GrantTypes.REFRESH]:
            return self.error(request=request, name="unsupported_grant_type")

        try:
            application = ApiApplication.objects.get(
                client_id=client_id, client_secret=client_secret, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            metrics.incr(
                "oauth_token.post.invalid",
                sample_rate=1.0,
            )
            logger.warning("Invalid client_id / secret pair", extra={"client_id": client_id})
            return self.error(
                request=request,
                name="invalid_credentials",
                reason="invalid client_id or client_secret",
                status=401,
            )

        if grant_type == GrantTypes.AUTHORIZATION:
            token_data = self.get_access_tokens(request=request, application=application)
        else:
            token_data = self.get_refresh_token(request=request, application=application)
        if "error" in token_data:
            return self.error(
                request=request,
                name=token_data["error"],
                reason=token_data["reason"] if "reason" in token_data else None,
            )
        return self.process_token_details(
            token=token_data["token"],
            id_token=token_data["id_token"] if "id_token" in token_data else None,
        )

    def get_access_tokens(self, request: Request, application: ApiApplication) -> dict:
        code = request.POST.get("code")
        try:
            grant = ApiGrant.objects.get(application=application, code=code)
        except ApiGrant.DoesNotExist:
            return {"error": "invalid_grant", "reason": "invalid grant"}

        if grant.is_expired():
            return {"error": "invalid_grant", "reason": "grant expired"}

        redirect_uri = request.POST.get("redirect_uri")
        if not redirect_uri:
            redirect_uri = application.get_default_redirect_uri()
        elif grant.redirect_uri != redirect_uri:
            return {"error": "invalid_grant", "reason": "invalid redirect URI"}

        token_data = {"token": ApiToken.from_grant(grant=grant)}
        if grant.has_scope("openid") and options.get("codecov.signing_secret"):
            open_id_token = OpenIDToken(
                request.POST.get("client_id"),
                grant.user_id,
                options.get("codecov.signing_secret"),
                nonce=request.POST.get("nonce"),
            )
            token_data["id_token"] = open_id_token.get_signed_id_token(grant=grant)
        return token_data

    def get_refresh_token(self, request: Request, application: ApiApplication) -> dict:
        refresh_token_code = request.POST.get("refresh_token")
        scope = request.POST.get("scope")

        if not refresh_token_code:
            return {"error": "invalid_request"}

        # TODO(dcramer): support scope
        if scope:
            return {"error": "invalid_request"}

        try:
            refresh_token = ApiToken.objects.get(
                application=application, refresh_token=refresh_token_code
            )
        except ApiToken.DoesNotExist:
            return {"error": "invalid_grant", "reason": "invalid request"}
        refresh_token.refresh()

        return {"token": refresh_token}

    def process_token_details(
        self, token: ApiToken, id_token: OpenIDToken | None = None
    ) -> HttpResponse:
        token_information = {
            "access_token": token.token,
            "refresh_token": token.refresh_token,
            "expires_in": (
                int((token.expires_at - timezone.now()).total_seconds())
                if token.expires_at
                else None
            ),
            "expires_at": token.expires_at,
            "token_type": "bearer",
            "scope": " ".join(token.get_scopes()),
            "user": {
                "id": str(token.user.id),
                # we might need these to become scope based
                "name": token.user.name,
                "email": token.user.email,
            },
        }
        if id_token:
            token_information["id_token"] = id_token
        return HttpResponse(
            json.dumps(token_information),
            content_type="application/json",
        )
