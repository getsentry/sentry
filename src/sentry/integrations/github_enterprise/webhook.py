# -*- coding: utf-8 -*-
from __future__ import absolute_import

import hashlib
import hmac
import logging
import six

from django.http import HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from sentry.models import Integration
from sentry.utils import json
from sentry.integrations.github.webhook import (
    InstallationEventWebhook,
    InstallationRepositoryEventWebhook,
    PushEventWebhook,
    PullRequestEventWebhook,
)
from .repository import GitHubEnterpriseRepositoryProvider

logger = logging.getLogger("sentry.webhooks")


def get_installation_metadata(event, host):
    if not host:
        return
    try:
        integration = Integration.objects.get(
            external_id=u"{}:{}".format(host, event["installation"]["id"]),
            provider="github_enterprise",
        )
    except Integration.DoesNotExist:
        return
    return integration.metadata["installation"]


class GitHubEnterpriseInstallationEventWebhook(InstallationEventWebhook):
    provider = "github_enterprise"


class GitHubEnterpriseInstallationRepositoryEventWebhook(InstallationRepositoryEventWebhook):
    provider = "github_enterprise"

    # https://developer.github.com/v3/activity/events/types/#installationrepositoriesevent
    def _handle(self, event, organization, repo):
        pass


class GitHubEnterprisePushEventWebhook(PushEventWebhook):
    provider = "github_enterprise"

    # https://developer.github.com/v3/activity/events/types/#pushevent
    def is_anonymous_email(self, email):
        return email[-25:] == "@users.noreply.github.com"

    def get_external_id(self, username):
        return "github_enterprise:%s" % username

    def get_idp_external_id(self, integration, host):
        return u"{}:{}".format(host, integration.metadata["installation"]["id"])

    def should_ignore_commit(self, commit):
        return GitHubEnterpriseRepositoryProvider.should_ignore_commit(commit["message"])


class GitHubEnterprisePullRequestEventWebhook(PullRequestEventWebhook):
    provider = "github_enterprise"

    # https://developer.github.com/v3/activity/events/types/#pullrequestevent
    def is_anonymous_email(self, email):
        return email[-25:] == "@users.noreply.github.com"

    def get_external_id(self, username):
        return "github_enterprise:%s" % username

    def get_idp_external_id(self, integration, host):
        return u"{}:{}".format(host, integration.metadata["installation"]["id"])


class GitHubEnterpriseWebhookBase(View):
    # https://developer.github.com/webhooks/
    def get_handler(self, event_type):
        return self._handlers.get(event_type)

    def is_valid_signature(self, method, body, secret, signature):
        if method != "sha1":
            raise NotImplementedError("signature method %s is not supported" % (method,))
        expected = hmac.new(
            key=secret.encode("utf-8"), msg=body, digestmod=hashlib.sha1
        ).hexdigest()
        return constant_time_compare(expected, signature)

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != "POST":
            return HttpResponse(status=405)

        return super(GitHubEnterpriseWebhookBase, self).dispatch(request, *args, **kwargs)

    def get_logging_data(self):
        pass

    def get_secret(self, event, host):
        metadata = get_installation_metadata(event, host)
        if metadata:
            return metadata.get("webhook_secret")
        else:
            return None

    def handle(self, request):
        body = six.binary_type(request.body)
        if not body:
            logger.warning("github_enterprise.webhook.missing-body", extra=self.get_logging_data())
            return HttpResponse(status=400)

        try:
            handler = self.get_handler(request.META["HTTP_X_GITHUB_EVENT"])
        except KeyError:
            logger.warning("github_enterprise.webhook.missing-event", extra=self.get_logging_data())
            return HttpResponse(status=400)

        if not handler:
            return HttpResponse(status=204)

        try:
            event = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.warning(
                "github_enterprise.webhook.invalid-json",
                extra=self.get_logging_data(),
                exc_info=True,
            )
            return HttpResponse(status=400)

        try:
            host = request.META["HTTP_X_GITHUB_ENTERPRISE_HOST"]
        except KeyError:
            logger.warning("github_enterprise.webhook.missing-enterprise-host")
            return HttpResponse(status=400)

        secret = self.get_secret(event, host)
        if not secret:
            logger.warning("github_enterprise.webhook.missing-integration", extra={"host": host})
            return HttpResponse(status=400)

        try:
            # Attempt to validate the signature. Older versions of
            # GitHub Enterprise do not send the signature so this is an optional step.
            method, signature = request.META["HTTP_X_HUB_SIGNATURE"].split("=", 1)
            if not self.is_valid_signature(method, body, secret, signature):
                logger.warning(
                    "github_enterprise.webhook.invalid-signature", extra=self.get_logging_data()
                )
                return HttpResponse(status=401)
        except (KeyError, IndexError) as e:
            logger.info(
                "github_enterprise.webhook.missing-signature",
                extra={"host": host, "error": six.text_type(e)},
            )
        handler()(event, host)
        return HttpResponse(status=204)


class GitHubEnterpriseWebhookEndpoint(GitHubEnterpriseWebhookBase):
    _handlers = {
        "push": GitHubEnterprisePushEventWebhook,
        "pull_request": GitHubEnterprisePullRequestEventWebhook,
        "installation": GitHubEnterpriseInstallationEventWebhook,
        "installation_repositories": GitHubEnterpriseInstallationRepositoryEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if request.method != "POST":
            return HttpResponse(status=405)

        return super(GitHubEnterpriseWebhookEndpoint, self).dispatch(request, *args, **kwargs)

    @method_decorator(csrf_exempt)
    def post(self, request):
        return self.handle(request)
