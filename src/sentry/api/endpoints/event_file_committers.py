from rest_framework.response import Response

from sentry import eventstore
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Commit, Group, Release
from sentry.utils.committers import get_serialized_event_file_committers


class EventFileCommittersEndpoint(ProjectEndpoint):
    def get(self, request, project, event_id):
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
        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        try:
            committers = get_serialized_event_file_committers(
                project, event, frame_limit=int(request.GET.get("frameLimit", 25))
            )
        except Group.DoesNotExist:
            return Response({"detail": "Issue not found"}, status=404)
        except Release.DoesNotExist:
            return Response({"detail": "Release not found"}, status=404)
        except Commit.DoesNotExist:
            return Response({"detail": "No Commits found for Release"}, status=404)

        # XXX(dcramer): this data is unused, so lets not bother returning it for now
        # serialize the commit objects
        # serialized_annotated_frames = [
        #     {
        #         'frame': frame['frame'],
        #         'commits': serialize(frame['commits'])
        #     } for frame in annotated_frames
        # ]

        data = {
            "committers": committers,
            # 'annotatedFrames': serialized_annotated_frames
        }
        return Response(data)
