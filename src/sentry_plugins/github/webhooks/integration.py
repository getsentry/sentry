from __future__ import annotations

import logging

from django.http import HttpResponse
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request

from sentry import options
from sentry.models.organization import Organization

from .base import GithubWebhookBase
from .events import InstallationEventWebhook, InstallationRepositoryEventWebhook, PushEventWebhook

logger = logging.getLogger(__name__)


class GithubPluginIntegrationsWebhookEndpoint(GithubWebhookBase):
    _handlers = {
        "push": PushEventWebhook,
        "installation": InstallationEventWebhook,
        "installation_repositories": InstallationRepositoryEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, *args, **kwargs) -> HttpResponseBase:
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def get_secret(self, organization: Organization) -> str | None:
        return options.get("github.integration-hook-secret")

    def post(self, request: Request) -> HttpResponse:
        logger.error(
            "github_plugin.install.deprecation_check",
            extra={"meta": request.META},
        )
        return self.handle(request)
