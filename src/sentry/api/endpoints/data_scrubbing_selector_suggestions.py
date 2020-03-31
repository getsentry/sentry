from __future__ import absolute_import

from rest_framework.response import Response
from django.utils.translation import ugettext

from sentry import eventstore
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.utils.apidocs import scenario, attach_scenarios

from sentry_relay import pii_selectors_from_event

DEFAULT_SUGGESTIONS = [
    {"type": "value", "value": "**", "description": ugettext("everywhere")},
    {"type": "value", "value": "password", "description": ugettext('attributes named "password"')},
    {"type": "value", "value": "$error.value", "description": ugettext("the exception value")},
    {"type": "value", "value": "$message", "description": ugettext("the log message")},
    {
        "type": "value",
        "value": "extra.'My Value'",
        "description": ugettext('the key "My Value" in "Additional Data"'),
    },
    {
        "type": "value",
        "value": "extra.**",
        "description": ugettext('everything in "Additional Data"'),
    },
    {
        "type": "value",
        "value": "$http.headers.x-custom-token",
        "description": ugettext("the X-Custom-Token HTTP header"),
    },
    {"type": "value", "value": "$user.ip_address", "description": ugettext("the user IP address")},
    {
        "type": "value",
        "value": "$frame.vars.foo",
        "description": ugettext('the local variable "foo"'),
    },
    {
        "type": "value",
        "value": "contexts.device.timezone",
        "description": ugettext("The timezone in the device context"),
    },
    {
        "type": "value",
        "value": "tags.server_name",
        "description": ugettext('the tag "server_name"'),
    },
]


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

        This list is used to auto-complete settings in "Data Privacy" /
        "Security and Privacy" settings.
        """

        event_id = request.GET.get("eventId", None)

        # Filtering by the projects that self.get_projects returns deals with
        # permission concerns
        projects = self.get_projects(request, organization)
        project_ids = [project.id for project in projects]

        selectors = set()

        if event_id:
            for event in eventstore.get_events(
                filter=eventstore.Filter(
                    conditions=[["id", "=", event_id]], project_ids=project_ids
                )
            ):
                selectors.update(pii_selectors_from_event(dict(event.data)))

        if not selectors:
            # Note: DEFAULT_SUGGESTIONS are best shown in-order
            suggestions = DEFAULT_SUGGESTIONS
        else:
            suggestions = [{"type": "value", "value": selector} for selector in selectors]

        return Response({"suggestions": suggestions})
