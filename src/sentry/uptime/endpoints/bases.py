from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.uptime.models import ProjectUptimeSubscription


class ProjectUptimeAlertEndpoint(ProjectEndpoint):
    owner = ApiOwner.CRONS
    permission_classes = (ProjectAlertRulePermission,)

    def convert_args(
        self,
        request: Request,
        uptime_project_subscription_id: str,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]

        try:
            kwargs["uptime_subscription"] = ProjectUptimeSubscription.objects.get(
                project=project, id=uptime_project_subscription_id
            )
        except ProjectUptimeSubscription.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
