from rest_framework.response import Response
from sentry_relay import pii_selector_suggestions_from_event

from sentry import eventstore
from sentry.api.bases.organization import OrganizationEndpoint


class DataScrubbingSelectorSuggestionsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
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

        suggestions = {}

        if event_id:
            for event in eventstore.get_events(
                filter=eventstore.Filter(event_ids=[event_id], project_ids=project_ids),
                referrer="api.data_scrubbing_selector_suggestions",
            ):
                for selector in pii_selector_suggestions_from_event(dict(event.data)):
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
