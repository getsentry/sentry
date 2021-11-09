import sentry_sdk

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.reprocessing2 import CannotReprocess, pull_event_data


class EventReprocessableEndpoint(ProjectEndpoint):
    def get(self, request, project, event_id):
        """
        Retrieve information about whether an event can be reprocessed.
        ```````````````````````````````````````````````````````````````

        Returns `{"reprocessable": true}` if the event can be reprocessed, or
        `{"reprocessable": false, "reason": "<code>"}` if it can't.

        Returns 404 if the reprocessing feature is disabled.

        Only entire issues can be reprocessed using
        `GroupReprocessingEndpoint`, but we can tell you whether we will even
        attempt to reprocess a particular event within that issue being
        reprocessed based on what we know ahead of time.  reprocessable=true
        means that the event may change in some way, reprocessable=false means
        that there is no way it will change/improve.

        Note this endpoint inherently suffers from time-of-check-time-of-use
        problem (time of check=calling this endpoint, time of use=triggering
        reprocessing) and the fact that event data + attachments is only
        eventually consistent.

        `<code>` can be:

        * `unprocessed_event.not_found`: Can have many reasons. The event
          is too old to be reprocessed (very unlikely!) or was not a native
          event.
        * `event.not_found`: The event does not exist.
        * `attachment.not_found`: A required attachment, such as the original
          minidump, is missing.

        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event.
        :auth: required
        """

        if not features.has(
            "organizations:reprocessing-v2", project.organization, actor=request.user
        ):
            return self.respond(
                {"error": "This project does not have the reprocessing v2 feature"},
                status=404,
            )

        try:
            pull_event_data(project.id, event_id)
        except CannotReprocess as e:
            sentry_sdk.set_tag("reprocessable", "false")
            sentry_sdk.set_tag("reprocessable.reason", str(e))
            return self.respond({"reprocessable": False, "reason": str(e)})
        else:
            sentry_sdk.set_tag("reprocessable", "true")
            return self.respond({"reprocessable": True})
