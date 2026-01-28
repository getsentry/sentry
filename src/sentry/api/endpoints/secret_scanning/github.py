import hashlib
import logging
from typing import Any

import sentry_sdk
from django.http import HttpResponse
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View

from sentry import options
from sentry.hybridcloud.models import ApiTokenReplica, OrgAuthTokenReplica
from sentry.models.apitoken import ApiToken
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.organizations.absolute_url import generate_organization_url
from sentry.organizations.services.organization import organization_service
from sentry.types.token import AuthTokenType
from sentry.users.models.user import User
from sentry.utils import json, metrics
from sentry.utils.email import MessageBuilder
from sentry.utils.github import verify_signature
from sentry.utils.http import absolute_uri
from sentry.web.frontend.base import control_silo_view

logger = logging.getLogger(__name__)

TOKEN_TYPE_HUMAN_READABLE = {
    AuthTokenType.USER: "Personal Token",
    AuthTokenType.ORG: "Organization Token",
}

REVOKE_URLS = {
    AuthTokenType.USER: "/settings/account/api/auth-tokens/",
    AuthTokenType.ORG: "/settings/auth-tokens/",
}


@control_silo_view
class SecretScanningGitHubEndpoint(View):
    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponseBase:
        if request.method != "POST":
            return HttpResponse(status=405)

        response = super().dispatch(request, *args, **kwargs)
        metrics.incr(
            "secret-scanning.github.webhooks",
            1,
            tags={"status": response.status_code},
            skip_internal=False,
        )
        return response

    def post(self, request: HttpRequest) -> HttpResponseBase:
        if request.headers.get("Content-Type") != "application/json":
            return HttpResponse(
                json.dumps({"details": "invalid content type specified"}), status=400
            )

        payload = request.body
        if options.get("secret-scanning.github.enable-signature-verification"):
            try:
                signature = request.headers["Github-Public-Key-Signature"]
                key_id = request.headers["Github-Public-Key-Identifier"]
                verify_signature(
                    payload,
                    signature,
                    key_id,
                    "secret_scanning",
                )
            except (KeyError, ValueError) as e:
                sentry_sdk.capture_exception(e)
                return HttpResponse(json.dumps({"details": "invalid signature"}), status=400)

        secret_alerts = json.loads(payload)
        response = []
        for secret_alert in secret_alerts:
            alerted_token_str = secret_alert["token"]
            hashed_alerted_token = hashlib.sha256(alerted_token_str.encode()).hexdigest()

            # no prefix tokens could indicate old user auth tokens with no prefixes
            token_type = AuthTokenType.USER
            if alerted_token_str.startswith(AuthTokenType.ORG):
                token_type = AuthTokenType.ORG
            elif alerted_token_str.startswith((AuthTokenType.USER_APP, AuthTokenType.INTEGRATION)):
                # TODO: add support for other token types
                return HttpResponse(
                    json.dumps({"details": "auth token type is not implemented"}), status=501
                )

            try:
                token: ApiToken | OrgAuthToken

                if token_type == AuthTokenType.USER:
                    token = ApiToken.objects.get(hashed_token=hashed_alerted_token)

                if token_type == AuthTokenType.ORG:
                    token = OrgAuthToken.objects.get(
                        token_hashed=hashed_alerted_token, date_deactivated=None
                    )

                extra = {
                    "exposed_source": secret_alert["source"],
                    "exposed_url": secret_alert["url"],
                    "hashed_token": hashed_alerted_token,
                    "token_type": token_type,
                }
                logger.info("found an exposed auth token", extra=extra)

                # TODO: mark an API token as exposed in the database

                # TODO: expose this option in the UI
                revoke_action_enabled = False
                if revoke_action_enabled:
                    # TODO: revoke token
                    pass

                # Send an email notification
                url_prefix = options.get("system.url-prefix")
                if isinstance(token, ApiToken):
                    # for personal token, send an alert to the token owner
                    users = User.objects.filter(id=token.user_id)
                elif isinstance(token, OrgAuthToken):
                    # for org token, send an alert to all organization owners
                    organization = organization_service.get(id=token.organization_id)
                    if organization is None:
                        continue

                    owner_members = organization_service.get_organization_owner_members(
                        organization_id=organization.id
                    )
                    user_ids = [om.user_id for om in owner_members]
                    users = User.objects.filter(id__in=user_ids)

                    url_prefix = generate_organization_url(organization.slug)

                token_type_human_readable = TOKEN_TYPE_HUMAN_READABLE.get(token_type, "Auth Token")

                revoke_url = absolute_uri(REVOKE_URLS.get(token_type, "/"), url_prefix=url_prefix)

                context = {
                    "datetime": timezone.now(),
                    "token_name": token.name,
                    "token_type": token_type_human_readable,
                    "token_redacted": f"{token_type}...{token.token_last_characters}",
                    "hashed_token": hashed_alerted_token,
                    "exposed_source": secret_alert["source"],
                    "exposed_url": secret_alert["url"],
                    "revoke_url": revoke_url,
                }

                subject = f"Action Required: {token_type_human_readable} Exposed"
                msg = MessageBuilder(
                    subject="{}{}".format(options.get("mail.subject-prefix"), subject),
                    template="sentry/emails/secret-scanning/body.txt",
                    html_template="sentry/emails/secret-scanning/body.html",
                    type="user.secret-scanning-alert",
                    context=context,
                )

                msg.send_async([u.email for u in users])

                response.append(
                    {
                        "token_hash": hashed_alerted_token,
                        "token_type": secret_alert["type"],
                        "label": "true_positive",
                    }
                )
            except (
                ApiToken.DoesNotExist,
                ApiTokenReplica.DoesNotExist,
                OrgAuthToken.DoesNotExist,
                OrgAuthTokenReplica.DoesNotExist,
            ):
                response.append(
                    {
                        "token_hash": hashed_alerted_token,
                        "token_type": secret_alert["type"],
                        "label": "false_positive",
                    }
                )

        return HttpResponse(json.dumps(response), status=200)
