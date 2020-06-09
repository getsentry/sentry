from __future__ import absolute_import

import six
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.utils.apidocs import scenario, attach_scenarios

from sentry_relay import pii_selector_suggestions_from_event


@scenario("GetSelectorSuggestionsForOrganization")
def get_selector_suggestions_for_organization_scenario(runner):
    runner.request(
        method="GET",
        path="/organizations/%s/data-scrubbing-selector-suggestions/" % (runner.org.slug,),
    )


class DataScrubbingSelectorSuggestionsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    @attach_scenarios([get_selector_suggestions_for_organization_scenario])
    def get(self, request, organization):
        """
        Generate a list of data scrubbing selectors from existing event data.

        This list is used to auto-complete settings in "Data Scrubbing" /
        "Security and Privacy" settings.
        """

        event_id = request.GET.get("eventId", None)

        # Filtering by the projects that self.get_projects returns deals with
        # permission concerns
        projects = self.get_projects(request, organization)
        project_ids = [project.id for project in projects]

        suggestions = {}

        if event_id:
            for event in eventstore.get_events(
                filter=eventstore.Filter(
                    conditions=[["id", "=", event_id]], project_ids=project_ids
                )
            ):
                for selector in pii_selector_suggestions_from_event(dict(event.data)):
                    examples_ = suggestions.setdefault(selector["path"], [])
                    if selector["value"]:
                        examples_.append(selector["value"])

        return Response(
            {
                "suggestions": [
                    {"type": "value", "value": value, "examples": examples}
                    for value, examples in six.iteritems(suggestions)
                ]
            }
        )
