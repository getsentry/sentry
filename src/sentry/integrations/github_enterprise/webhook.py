from __future__ import annotations

import hashlib
import hmac
import logging

from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.integrations.github.webhook import (
    InstallationEventWebhook,
    PullRequestEventWebhook,
    PushEventWebhook,
    get_github_external_id,
)
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.utils import json, metrics
from sentry.utils.sdk import configure_scope

from .repository import GitHubEnterpriseRepositoryProvider

logger = logging.getLogger("sentry.webhooks")
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.integration.model import RpcIntegration


def get_host(request: HttpRequest) -> str | None:
    # XXX: There's lots of customers that are giving us an IP rather than a host name
    # Use HTTP_X_REAL_IP in a follow up PR (#42405)
    return request.META.get("HTTP_X_GITHUB_ENTERPRISE_HOST")


def get_installation_metadata(event, host):
    if not host:
        return
    external_id = get_github_external_id(event=event, host=host)
    integration = integration_service.get_integration(
        external_id=external_id,
        provider="github_enterprise",
    )
    if integration is None:
        metrics.incr("integrations.github_enterprise.does_not_exist")
        return
    return integration.metadata["installation"]


class GitHubEnterpriseInstallationEventWebhook(InstallationEventWebhook):
    provider = "github_enterprise"


class GitHubEnterprisePushEventWebhook(PushEventWebhook):
    provider = "github_enterprise"

    # https://developer.github.com/v3/activity/events/types/#pushevent
    def is_anonymous_email(self, email: str) -> bool:
        return email[-25:] == "@users.noreply.github.com"

    def get_external_id(self, username: str) -> str:
        return f"github_enterprise:{username}"

    def get_idp_external_id(self, integration: RpcIntegration, host: str | None = None) -> str:
        return "{}:{}".format(host, integration.metadata["installation"]["id"])

    def should_ignore_commit(self, commit):
        return GitHubEnterpriseRepositoryProvider.should_ignore_commit(commit["message"])


class GitHubEnterprisePullRequestEventWebhook(PullRequestEventWebhook):
    provider = "github_enterprise"

    # https://developer.github.com/v3/activity/events/types/#pullrequestevent
    def is_anonymous_email(self, email: str) -> bool:
        return email[-25:] == "@users.noreply.github.com"

    def get_external_id(self, username: str) -> str:
        return f"github_enterprise:{username}"

    def get_idp_external_id(self, integration: RpcIntegration, host: str | None = None) -> str:
        return "{}:{}".format(host, integration.metadata["installation"]["id"])


class GitHubEnterpriseWebhookBase(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    # https://developer.github.com/webhooks/
    def get_handler(self, event_type):
        return self._handlers.get(event_type)

    def is_valid_signature(self, method, body, secret, signature):
        if method != "sha1":
            raise NotImplementedError(f"signature method {method} is not supported")
        expected = hmac.new(
            key=secret.encode("utf-8"), msg=body, digestmod=hashlib.sha1
        ).hexdigest()
        return constant_time_compare(expected, signature)

    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, *args, **kwargs) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def get_secret(self, event, host):
        metadata = get_installation_metadata(event, host)
        if metadata:
            return metadata.get("webhook_secret")
        else:
            return None

    def handle(self, request: Request) -> HttpResponse:
        clear_tags_and_context()
        with configure_scope() as scope:
            meta = request.META
            host = get_host(request=request)
            if not host:
                logger.warning("github_enterprise.webhook.missing-enterprise-host")
                logger.error("Missing enterprise host.")
                return HttpResponse(status=400)

            extra = {"host": host}
            # If we do tag the host early we can't even investigate
            scope.set_tag("host", host)

            body = bytes(request.body)
            if not body:
                logger.warning("github_enterprise.webhook.missing-body", extra=extra)
                return HttpResponse(status=400)

            try:
                handler = self.get_handler(meta["HTTP_X_GITHUB_EVENT"])
            except KeyError:
                logger.warning("github_enterprise.webhook.missing-event", extra=extra)
                logger.exception("Missing Github event in webhook.")
                return HttpResponse(status=400)

            if not handler:
                return HttpResponse(status=204)

            try:
                # XXX: Sometimes they send us this b'payload=%7B%22ref%22 Support this
                # See https://sentry.io/organizations/sentry/issues/2565421410
                event = json.loads(body.decode("utf-8"))
            except json.JSONDecodeError:
                logger.warning(
                    "github_enterprise.webhook.invalid-json",
                    extra=extra,
                    exc_info=True,
                )
                logger.exception("Invalid JSON.")
                return HttpResponse(status=400)

            secret = self.get_secret(event, host)
            if not secret:
                logger.warning("github_enterprise.webhook.missing-integration", extra=extra)
                return HttpResponse(status=400)

            try:
                # Attempt to validate the signature. Older versions of
                # GitHub Enterprise do not send the signature so this is an optional step.
                method, signature = meta["HTTP_X_HUB_SIGNATURE"].split("=", 1)
                if not self.is_valid_signature(method, body, secret, signature):
                    logger.warning("github_enterprise.webhook.invalid-signature", extra=extra)
                    return HttpResponse(status=401)
            except (KeyError, IndexError) as e:
                extra["error"] = str(e)
                logger.info("github_enterprise.webhook.missing-signature", extra=extra)
                logger.exception("Missing webhook secret.")
            handler()(event, host)
            return HttpResponse(status=204)


@region_silo_endpoint
class GitHubEnterpriseWebhookEndpoint(GitHubEnterpriseWebhookBase):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }
    _handlers = {
        "push": GitHubEnterprisePushEventWebhook,
        "pull_request": GitHubEnterprisePullRequestEventWebhook,
        "installation": GitHubEnterpriseInstallationEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, *args, **kwargs) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    @method_decorator(csrf_exempt)
    def post(self, request: Request) -> HttpResponse:
        return self.handle(request)
