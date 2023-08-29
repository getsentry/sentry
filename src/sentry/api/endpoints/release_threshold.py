from rest_framework.request import HttpResponse, Request

from sentry.api.api_owners import ApiOwner
from sentry.api.base import Endpoint
from sentry.models import Project


class ReleaseThresholdEndpoint(Endpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE

    def post(self, request: Request, project: Project) -> HttpResponse:
        pass
