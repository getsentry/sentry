from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.release import Release
from sentry.utils.committers import get_serialized_event_file_committers


@region_silo_endpoint
class EventFileCommittersEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project, event_id) -> Response:
        """
        Retrieve Committer information for an event
        ```````````````````````````````````````````

        Return committers on an individual event, plus a per-frame breakdown.

        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the hexadecimal ID of the event to
                                 retrieve (as reported by the raven client).
        :auth: required
        """
        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        try:
            committers = get_serialized_event_file_committers(
                project, event, frame_limit=int(request.GET.get("frameLimit", 25))
            )

        # TODO(nisanthan): Remove the Group.DoesNotExist and Release.DoesNotExist once Commit Context goes GA
        except Group.DoesNotExist:
            raise NotFound(detail="Issue not found")
        except Release.DoesNotExist:
            raise NotFound(detail="Release not found")
        except Commit.DoesNotExist:
            raise NotFound(detail="No Commits found for Release")

        data = {
            "committers": committers,
        }

        return Response(data)
