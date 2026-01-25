import orjson
from django.http import HttpRequest, HttpResponse

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.event import EventEndpoint
from sentry.grouping.api import load_grouping_config
from sentry.grouping.grouping_info import get_grouping_info
from sentry.interfaces.stacktrace import StacktraceOrder
from sentry.models.project import Project
from sentry.services.eventstore.models import Event
from sentry.users.services.user_option import user_option_service
from sentry.users.services.user_option.service import get_option_from_list


@region_silo_endpoint
class EventGroupingInfoEndpoint(EventEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: HttpRequest, project: Project, event: Event) -> HttpResponse:
        """
        Returns the grouping information for an event
        `````````````````````````````````````````````

        This endpoint returns a JSON dump of the metadata that went into the
        grouping algorithm.
        """
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

        grouping_info = get_grouping_info(grouping_config, project, event)

        return HttpResponse(
            orjson.dumps(grouping_info, option=orjson.OPT_UTC_Z), content_type="application/json"
        )
