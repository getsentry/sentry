from sentry import features
from sentry.api.bases import GroupEndpoint
from sentry.tasks.reprocessing2 import reprocess_group


class GroupReprocessingEndpoint(GroupEndpoint):
    def post(self, request, group):
        """
        Reprocess a group
        `````````````````

        This endpoint triggers reprocessing for all events in a group.

        :pparam string issue_id: the numeric ID of the issue to reprocess. The
            reprocessed events will be assigned to a new numeric ID. See comments
            in sentry.reprocessing2.
        :auth: required
        """

        if not features.has(
            "organizations:reprocessing-v2", group.project.organization, actor=request.user
        ):
            return self.respond(
                {"error": "This project does not have the reprocessing v2 feature"},
                status=404,
            )

        max_events = request.data.get("maxEvents")
        if max_events:
            max_events = int(max_events)

            if max_events <= 0:
                return self.respond({"error": "maxEvents must be at least 1"}, status=400)
        else:
            max_events = None

        remaining_events = request.data.get("remainingEvents")
        if remaining_events not in ("delete", "keep"):
            return self.respond({"error": "remainingEvents must be delete or keep"}, status=400)

        reprocess_group.delay(
            project_id=group.project_id,
            group_id=group.id,
            max_events=max_events,
            acting_user_id=getattr(request.user, "id", None),
            remaining_events=remaining_events,
        )
        return self.respond(status=200)
