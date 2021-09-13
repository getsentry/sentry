from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Project
from sentry.notifications.utils import has_alert_integration


class ProjectHasAlertIntegrationInstalled(ProjectEndpoint):
    def get(self, request: Request, project: Project) -> Response:
        return self.respond({"hasAlertIntegrationInstalled": has_alert_integration(project)})
