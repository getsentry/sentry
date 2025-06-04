import orjson
from django.http import HttpRequest, HttpResponse

from sentry import eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.grouping.grouping_info import get_grouping_info


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
        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            raise ResourceDoesNotExist

        _grouping_info = get_grouping_info(request.GET.get("config", None), project, event)

        # TODO: All of the below is a temporary hack to preserve compatibility between the BE and FE as
        # we transition from using dashes in the keys/variant types to using underscores. For now, until
        # we change the FE, we switch back to dashes before sending the data.
        grouping_info = {}

        for key, variant_dict in _grouping_info.items():
            new_key = key.replace("_", "-")
            new_type = variant_dict.get("type", "").replace("_", "-")

            variant_dict["key"] = new_key
            if "type" in variant_dict:
                variant_dict["type"] = new_type

            grouping_info[new_key] = variant_dict

        return HttpResponse(
            orjson.dumps(grouping_info, option=orjson.OPT_UTC_Z), content_type="application/json"
        )
