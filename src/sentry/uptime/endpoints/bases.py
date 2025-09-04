from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.uptime.types import (
    DATA_SOURCE_UPTIME_SUBSCRIPTION,
    GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
)
from sentry.workflow_engine.models import Detector


class ProjectUptimeAlertEndpoint(ProjectEndpoint):
    owner = ApiOwner.CRONS
    permission_classes = (ProjectAlertRulePermission,)

    def convert_args(
        self,
        request: Request,
        # XXX(epurkhiser): THIS IS A DETECTOR
        #
        # This name is completely wrong, but there's a test in getsentry that's
        # using this parameter name that we'll have to fix first to change it.
        uptime_project_subscription_id: str,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]

        try:
            kwargs["uptime_detector"] = Detector.objects.get(
                project=project,
                id=uptime_project_subscription_id,
                type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
                data_sources__type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            )
        except Detector.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
