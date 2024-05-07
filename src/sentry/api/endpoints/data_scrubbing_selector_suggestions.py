from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response
from sentry_relay.processing import pii_selector_suggestions_from_event

from sentry import nodestore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.eventstore.models import Event
from sentry.utils.json import methods_for_experiment


@region_silo_endpoint
class DataScrubbingSelectorSuggestionsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def get(self, request: Request, organization) -> Response:
        """
        Generate a list of data scrubbing selectors from existing event data.

        This list is used to auto-complete settings in "Data Scrubbing" /
        "Security and Privacy" settings.
        """

        event_id = request.GET.get("eventId", None)

        # For organization settings we access all projects the user has access
        # to. For the project level, `get_projects` will give us back a single
        # project.
        #
        # Filtering by the projects that self.get_projects returns deals with
        # permission concerns.
        #
        # The org-wide search for the event ID is quite slow, but we cannot fix
        # that without product redesign.
        projects = self.get_projects(request, organization)
        project_ids = [project.id for project in projects]

        suggestions: dict[str, Any] = {}

        if event_id:
            # go to nodestore directly instead of eventstore.get_events, which
            # would not return transaction events
            node_ids = [Event.generate_node_id(p, event_id) for p in project_ids]
            all_data = nodestore.backend.get_multi(node_ids)

            json_loads, json_dumps = methods_for_experiment("relay.enable-orjson")
            data: dict[str, Any]
            for data in filter(None, all_data.values()):
                for selector in pii_selector_suggestions_from_event(
                    data, json_loads=json_loads, json_dumps=json_dumps
                ):
                    examples_ = suggestions.setdefault(selector["path"], [])
                    if selector["value"]:
                        examples_.append(selector["value"])

        return Response(
            {
                "suggestions": [
                    {"type": "value", "value": value, "examples": examples}
                    for value, examples in suggestions.items()
                ]
            }
        )
