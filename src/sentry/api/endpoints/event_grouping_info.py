import orjson
from django.http import HttpRequest, HttpResponse

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.grouping.api import load_grouping_config
from sentry.grouping.grouping_info import get_grouping_info
from sentry.interfaces.stacktrace import StacktraceOrder
from sentry.services import eventstore
from sentry.users.services.user_option import user_option_service
from sentry.users.services.user_option.service import get_option_from_list


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

        grouping_config = load_grouping_config(event.get_grouping_config())

        # We want the stacktraces in the grouping info to match the issue details page's main
        # stacktrace, which by default is upside down compared to the event JSON. Therefore, unless
        # user has set a preference to prevent it, we want to flip the grouping info stacktraces,
        # too.
        should_reverse_stacktraces = (
            get_option_from_list(
                user_option_service.get_many(filter={"user_ids": [request.user.id]}),
                key="stacktrace_order",
            )
            != StacktraceOrder.MOST_RECENT_LAST
        )
        grouping_config.initial_context["reverse_stacktraces"] = should_reverse_stacktraces

        _grouping_info = get_grouping_info(grouping_config, project, event)

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
