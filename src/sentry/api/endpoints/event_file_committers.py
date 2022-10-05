from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.commit import CommitSerializer
from sentry.models import Commit, Group, Release
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.utils.committers import (
    get_serialized_event_file_committers,
    get_serialized_release_committers_for_group,
)


@region_silo_endpoint
class EventFileCommittersEndpoint(ProjectEndpoint):
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
        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        if features.has("organizations:commit-context", project.organization, actor=request.user):
            group_owners = GroupOwner.objects.filter(
                group_id=event.group_id,
                project=project,
                organization_id=project.organization_id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                context__isnull=False,
            ).order_by("-date_added")
            owner = next(filter(lambda go: go.context.get("commitId"), group_owners), None)
            if not owner:
                return Response({"committers": []})
            commit = Commit.objects.get(id=owner.context.get("commitId"))

            return Response(
                {
                    "committers": [
                        {
                            "author": serialize(owner.user),
                            "commits": [
                                serialize(commit, serializer=CommitSerializer(exclude=["author"]))
                            ],
                        }
                    ]
                }
            )
        else:
            try:
                committers = get_serialized_event_file_committers(
                    project, event, frame_limit=int(request.GET.get("frameLimit", 25))
                )
            except Group.DoesNotExist:
                raise NotFound(detail="Issue not found")
            except Release.DoesNotExist:
                raise NotFound(detail="Release not found")
            except Commit.DoesNotExist:
                raise NotFound(detail="No Commits found for Release")

            data = {
                "committers": committers,
            }

            if features.has(
                "organizations:release-committer-assignees",
                project.organization,
                actor=request.user,
            ):
                data["releaseCommitters"] = get_serialized_release_committers_for_group(event.group)

            return Response(data)
