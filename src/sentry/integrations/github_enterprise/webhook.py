from __future__ import annotations

import hashlib
import hmac
import logging
import re

import sentry_sdk
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from rest_framework.exceptions import AuthenticationFailed

from sentry import options
from sentry.api.exceptions import BadRequest
from sentry.constants import ObjectStatus
from sentry.integrations.github.webhook import (
    GitHubWebhook,
    InstallationEventWebhook,
    PullRequestEventWebhook,
    PushEventWebhook,
    get_github_external_id,
)
from sentry.integrations.source_code_management.webhook import SCMWebhookEndpoint
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.utils import metrics
from sentry.utils.sdk import Scope

logger = logging.getLogger("sentry.webhooks")
from sentry.api.base import region_silo_endpoint
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration

SHA1_PATTERN = r"^sha1=[0-9a-fA-F]{40}$"
SHA256_PATTERN = r"^sha256=[0-9a-fA-F]{64}$"

INVALID_SIGNATURE_ERROR = "Provided signature does not match the computed body signature"
MALFORMED_SIGNATURE_ERROR = "Signature value does not match the expected format"
UNSUPPORTED_SIGNATURE_ALGORITHM_ERROR = "Signature algorithm is unsupported"
MISSING_WEBHOOK_PAYLOAD_ERROR = "Webhook payload not found"
MISSING_GITHUB_ENTERPRISE_HOST_ERROR = "Missing X-GitHub-Enterprise-Host header"
MISSING_GITHUB_EVENT_HEADER_ERROR = "Missing X-GitHub-Event header"
MISSING_SIGNATURE_HEADERS_ERROR = "Missing headers X-Hub-Signature-256 or X-Hub-Signature"


class MissingRequiredHeaderError(Exception):
    pass


class MissingWebhookPayloadError(Exception):
    """Webhook payload not found"""


class InvalidSignatureError(Exception):
    """Provided signature does not match the computed body signature"""


class MalformedSignatureError(Exception):
    """Signature value does not match the expected format"""


class UnsupportedSignatureAlgorithmError(Exception):
    """Signature algorithm is unsupported"""


def get_host(request: HttpRequest) -> str | None:
    # XXX: There's lots of customers that are giving us an IP rather than a host name
    # Use HTTP_X_REAL_IP in a follow up PR (#42405)
    return request.headers.get("x-github-enterprise-host")


def get_installation_metadata(event, host):
    if not host:
        return
    external_id = get_github_external_id(event=event, host=host)
    integration = integration_service.get_integration(
        external_id=external_id,
        provider="github_enterprise",
        status=ObjectStatus.ACTIVE,
    )
    if integration is None:
        metrics.incr("integrations.github_enterprise.does_not_exist")
        return
    return integration.metadata["installation"]


class GitHubEnterpriseWebhook:
    @property
    def provider(self) -> str:
        return "github_enterprise"

    def get_external_id(self, username: str) -> str:
        return f"github_enterprise:{username}"

    def get_idp_external_id(self, integration: RpcIntegration, host: str | None = None) -> str:
        return "{}:{}".format(host, integration.metadata["installation"]["id"])


class GitHubEnterpriseInstallationEventWebhook(GitHubEnterpriseWebhook, InstallationEventWebhook):
    pass


class GitHubEnterprisePushEventWebhook(GitHubEnterpriseWebhook, PushEventWebhook):
    pass


class GitHubEnterprisePullRequestEventWebhook(GitHubEnterpriseWebhook, PullRequestEventWebhook):
    pass


@region_silo_endpoint
class GitHubEnterpriseWebhookEndpoint(SCMWebhookEndpoint[GitHubWebhook]):
    @property
    def provider(self) -> str:
        return "github_enterprise"

    @property
    def _handlers(self) -> dict[str, type[GitHubWebhook]]:
        return {
            "push": GitHubEnterprisePushEventWebhook,
            "pull_request": GitHubEnterprisePullRequestEventWebhook,
            "installation": GitHubEnterpriseInstallationEventWebhook,
        }

    @property
    def method_header(self) -> str:
        return "x-github-event"

    def is_valid_signature(self, method: str, body: bytes, secret: str, signature: str) -> bool:
        if method != "sha1" and method != "sha256":
            raise UnsupportedSignatureAlgorithmError()

        if method == "sha256":
            expected = hmac.new(
                key=secret.encode("utf-8"), msg=body, digestmod=hashlib.sha256
            ).hexdigest()
        else:
            expected = hmac.new(
                key=secret.encode("utf-8"), msg=body, digestmod=hashlib.sha1
            ).hexdigest()

        return constant_time_compare(expected, signature)

    def check_secret(self, **kwargs) -> str:
        metadata = get_installation_metadata(kwargs.get("event"), kwargs.get("host"))
        if metadata:
            return metadata.get("webhook_secret", "")
        else:
            logger.warning("github_enterprise.webhook.missing-integration", extra=self.log_extra)
            raise BadRequest()

    def check_signature(self, request: HttpRequest, body: bytes, secret: str, host: str) -> None:
        try:
            sha256_signature = request.headers.get("x-hub-signature-256")
            sha1_signature = request.headers.get("x-hub-signature")

            if not sha256_signature and not sha1_signature:
                raise MissingRequiredHeaderError()

            if sha256_signature:
                if not re.match(SHA256_PATTERN, sha256_signature):
                    # before we try to parse the parts of the signature, make sure it
                    # looks as expected to avoid any IndexErrors when we split it
                    raise MalformedSignatureError()

                _, signature = sha256_signature.split("=", 1)
                self.log_extra["signature_algorithm"] = "sha256"
                is_valid = self.is_valid_signature("sha256", body, secret, signature)
                if not is_valid:
                    raise InvalidSignatureError()

            if sha1_signature:
                if not re.match(SHA1_PATTERN, sha1_signature):
                    # before we try to parse the parts of the signature, make sure it
                    # looks as expected to avoid any IndexErrors when we split it
                    raise MalformedSignatureError()

                _, signature = sha1_signature.split("=", 1)
                is_valid = self.is_valid_signature("sha1", body, secret, signature)
                self.log_extra["signature_algorithm"] = "sha1"
                if not is_valid:
                    raise InvalidSignatureError()

        except InvalidSignatureError as e:
            logger.warning("github_enterprise.webhook.invalid-signature", extra=self.log_extra)
            sentry_sdk.capture_exception(e)

            raise AuthenticationFailed(INVALID_SIGNATURE_ERROR)
        except UnsupportedSignatureAlgorithmError as e:
            # we should never end up here with the regex checks above on the signature format,
            # but just in case
            logger.exception(
                "github-enterprise-app.webhook.unsupported-signature-algorithm",
                extra=self.log_extra,
            )
            sentry_sdk.capture_exception(e)
            raise BadRequest(UNSUPPORTED_SIGNATURE_ALGORITHM_ERROR)

        except MissingRequiredHeaderError as e:
            # older versions of GitHub 2.14.0 and older do not always send signature headers
            # Setting a signature secret is optional in GitHub, but we require it on Sentry
            # Only a small subset of legacy hosts are allowed to skip the signature verification
            # at the moment.

            allowed_legacy_hosts = options.get(
                "github-enterprise-app.allowed-hosts-legacy-webhooks"
            )

            if host not in allowed_legacy_hosts:
                # the host is not allowed to skip signature verification by omitting the headers
                logger.warning("github_enterprise.webhook.missing-signature", extra=self.log_extra)
                sentry_sdk.capture_exception(e)
                raise BadRequest(MISSING_SIGNATURE_HEADERS_ERROR)
            else:
                # the host is allowed to skip signature verification
                # log it, and continue on.
                self.log_extra["github_enterprise_version"] = request.headers.get(
                    "x-github-enterprise-version"
                )
                self.log_extra["ip_address"] = request.headers.get("x-real-ip")
                logger.info(
                    "github_enterprise.webhook.allowed-missing-signature", extra=self.log_extra
                )
                sentry_sdk.capture_message("Allowed missing signature")

        except (MalformedSignatureError, IndexError) as e:
            logger.warning("github_enterprise.webhook.malformed-signature", extra=self.log_extra)
            sentry_sdk.capture_exception(e)
            raise BadRequest(MALFORMED_SIGNATURE_ERROR)

    def post(self, request: HttpRequest, **kwargs) -> HttpResponse:
        clear_tags_and_context()
        scope = Scope.get_isolation_scope()

        try:
            host = get_host(request=request)
            if not host:
                raise MissingRequiredHeaderError()
        except MissingRequiredHeaderError as e:
            logger.exception("github_enterprise.webhook.missing-enterprise-host")
            sentry_sdk.capture_exception(e)
            return HttpResponse(MISSING_GITHUB_ENTERPRISE_HOST_ERROR, status=400)

        self.log_extra["host"] = host
        # If we do tag the host early we can't even investigate
        scope.set_tag("host", host)

        body = self.get_body(request.body)
        handler = self.get_handler(request)

        if not handler:
            return HttpResponse(status=204)

        # XXX: Sometimes they send us this b'payload=%7B%22ref%22 Support this
        # See https://sentry.io/organizations/sentry/issues/2565421410
        event = self.get_event(body)

        secret = self.check_secret(event=event, host=host)

        self.check_signature(request, body, secret, host)

        self.fire_event_handler(handler(), event, host=host)

        return HttpResponse(status=204)
