from django.http import HttpRequest, HttpResponse

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.grouping.grouping_info import get_grouping_info
from sentry.utils import json


@region_silo_endpoint
class EventGroupingInfoEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: HttpRequest, project, event_id) -> HttpResponse:
        """
        Returns the grouping information for an event
        `````````````````````````````````````````````

        This endpoint returns a JSON dump of the metadata that went into the
        grouping algorithm.
        """
        grouping_info = get_grouping_info(request.GET.get("config", None), project, event_id)

        return HttpResponse(json.dumps(grouping_info), content_type="application/json")
