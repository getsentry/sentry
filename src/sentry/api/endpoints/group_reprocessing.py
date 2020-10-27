from __future__ import absolute_import


from sentry import features
from sentry.api.bases import GroupEndpoint
from sentry.tasks.reprocessing2 import reprocess_group


class GroupReprocessingEndpoint(GroupEndpoint):
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
            return self.respond(
                {"error": "This project does not have the reprocessing v2 feature"}, status=404,
            )

        max_events = request.data.get("maxEvents")
        if max_events:
            max_events = int(max_events)

            if max_events <= 0:
                return self.respond({"error": "maxEvents must be at least 1"}, status=400,)
        else:
            max_events = None

        reprocess_group.delay(
            project_id=group.project_id,
            group_id=group.id,
            max_events=max_events,
            acting_user_id=request.user.id,
        )
        return self.respond(status=200)
