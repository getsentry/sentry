from typing import Any

from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import to_valid_int_id
from sentry.constants import ObjectStatus
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
        uptime_detector_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]
        validated_uptime_detector_id = to_valid_int_id(
            "uptime_detector_id", uptime_detector_id, raise_404=True
        )

        try:
            kwargs["uptime_detector"] = Detector.objects.with_type_filters().get(
                project=project,
                id=validated_uptime_detector_id,
                type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
                data_sources__type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
                status__in=[ObjectStatus.ACTIVE, ObjectStatus.DISABLED],
            )
        except Detector.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
