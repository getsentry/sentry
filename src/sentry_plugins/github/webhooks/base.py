import hashlib
import hmac
import logging

from django.http import HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils import json

from .events import PullRequestEventWebhook, PushEventWebhook

logger = logging.getLogger("sentry.webhooks")


class GithubWebhookBase(View):
    _handlers = {"push": PushEventWebhook, "pull_request": PullRequestEventWebhook}

    # https://developer.github.com/webhooks/
    def get_handler(self, event_type):
        return self._handlers.get(event_type)

    def is_valid_signature(self, method, body, secret, signature):
        if method == "sha1":
            mod = hashlib.sha1
        else:
            raise NotImplementedError(f"signature method {method} is not supported")
        expected = hmac.new(key=secret.encode("utf-8"), msg=body, digestmod=mod).hexdigest()
        return constant_time_compare(expected, signature)

    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def get_logging_data(self, organization):
        pass

    def get_secret(self, organization):
        raise NotImplementedError

    def handle(self, request: Request, organization=None) -> Response:
        secret = self.get_secret(organization)

        if secret is None:
            logger.error("github.webhook.missing-secret", extra=self.get_logging_data(organization))
            return HttpResponse(status=401)

        body = bytes(request.body)
        if not body:
            logger.error("github.webhook.missing-body", extra=self.get_logging_data(organization))
            return HttpResponse(status=400)

        try:
            handler = self.get_handler(request.META["HTTP_X_GITHUB_EVENT"])
        except KeyError:
            logger.error("github.webhook.missing-event", extra=self.get_logging_data(organization))
            return HttpResponse(status=400)

        if not handler:
            return HttpResponse(status=204)

        try:
            method, signature = request.META["HTTP_X_HUB_SIGNATURE"].split("=", 1)
        except (KeyError, IndexError):
            logger.info(
                "github.webhook.missing-signature", extra=self.get_logging_data(organization)
            )
            return HttpResponse(status=400)

        if not self.is_valid_signature(method, body, self.get_secret(organization), signature):
            logger.error(
                "github.webhook.invalid-signature", extra=self.get_logging_data(organization)
            )
            return HttpResponse(status=401)

        try:
            event = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.error(
                "github.webhook.invalid-json",
                extra=self.get_logging_data(organization),
                exc_info=True,
            )
            return HttpResponse(status=400)

        handler()(event, organization=organization)
        return HttpResponse(status=204)
