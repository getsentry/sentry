from __future__ import absolute_import

import time

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.tasks.reprocessing2 import reprocess_event


class EventReprocessingEndpoint(ProjectEndpoint):
    def post(self, request, project, event_id):
        """
        Reprocess a single event
        ````````````````````````

        Triggers reprocessing for a single event. Currently this means
        duplicating the event with a new event ID and bumped timestamps.

        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event.
        :auth: required
        """
        if not features.has("projects:reprocessing-v2", project, actor=request.user):
            return self.respond(status=404)

        start_time = time.time()

        reprocess_event.delay(project_id=project.id, event_id=event_id, start_time=start_time)

        return self.respond(status=200)
