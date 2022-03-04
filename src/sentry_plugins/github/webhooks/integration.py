from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options

from .base import GithubWebhookBase
from .events import InstallationEventWebhook, InstallationRepositoryEventWebhook, PushEventWebhook


class GithubIntegrationsWebhookEndpoint(GithubWebhookBase):
    _handlers = {
        "push": PushEventWebhook,
        "installation": InstallationEventWebhook,
        "installation_repositories": InstallationRepositoryEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def get_secret(self, organization):
        return options.get("github.integration-hook-secret")

    def post(self, request: Request) -> Response:
        return self.handle(request)
