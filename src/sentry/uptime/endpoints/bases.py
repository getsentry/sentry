from rest_framework.request import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.uptime.models import ProjectUptimeSubscription, get_detector
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
        # XXX(epurkhiser): There's a getsentry test that depends on this
        # argument name, when we change this over to purely detector_id we
        # should make the effort to fix the parameter name then
        uptime_project_subscription_id: str,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]

        # Check feature flag and query parameter to determine if ID should be treated as detector ID
        detector_ids_by_default = features.has(
            "organizations:uptime-detector-ids-by-default", project.organization, actor=request.user
        )
        use_detector_id = detector_ids_by_default or request.GET.get("useDetectorId") == "1"

        # XXX(epurkhiser): We can remove this dual reading logic once all
        # endpoints are using the Detector IDs over ProjectUptimeSubscription
        # IDs.
        if use_detector_id:
            # Treat ID as detector ID - find detector and its associated subscription
            try:
                detector = Detector.objects.get(
                    project=project,
                    id=uptime_project_subscription_id,
                    type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
                    data_sources__type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
                )
                # Get the uptime subscription from the detector's data source
                data_source = detector.data_sources.get(type=DATA_SOURCE_UPTIME_SUBSCRIPTION)
                uptime_subscription_id = data_source.source_id
                uptime_monitor = ProjectUptimeSubscription.objects.get(
                    project=project, uptime_subscription__id=uptime_subscription_id
                )
                kwargs["uptime_detector"] = detector
                kwargs["uptime_monitor"] = uptime_monitor
            except (Detector.DoesNotExist, ProjectUptimeSubscription.DoesNotExist, AttributeError):
                raise ResourceDoesNotExist
        else:
            # Treat ID as project uptime subscription ID (legacy behavior)
            try:
                uptime_monitor = ProjectUptimeSubscription.objects.get(
                    project=project, id=uptime_project_subscription_id
                )
                detector = get_detector(uptime_monitor.uptime_subscription)
                kwargs["uptime_detector"] = detector
                kwargs["uptime_monitor"] = uptime_monitor
            except ProjectUptimeSubscription.DoesNotExist:
                raise ResourceDoesNotExist

        return args, kwargs
