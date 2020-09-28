from __future__ import absolute_import


from sentry import features
from sentry.api.base import DocSection
from sentry.api.bases import GroupEndpoint
from sentry.models import Group
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.tasks.reprocessing2 import reprocess_group


@scenario("ReprocessGroup")
def reprocess_group_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(method="POST", path="/issues/%s/reprocessing/" % group.id)


class GroupReprocessingEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    @attach_scenarios([reprocess_group_scenario])
    def post(self, request, group):
        """
        Reprocess a group
        `````````````````

        This endpoint triggers reprocessing for all events in a group.
        Currently this means duplicating the events with new event IDs and
        bumped timestamps.

        :pparam string issue_id: the ID of the issue to retrieve.
        :auth: required
        """

        if not features.has("projects:reprocessing-v2", group.project, actor=request.user):
            return self.respond(status=404)

        max_events = int(request.data.get("maxEvents") or 0) or None

        reprocess_group.delay(project_id=group.project_id, group_id=group.id, max_events=max_events)
        return self.respond(status=200)
