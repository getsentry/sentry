from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.event import EventEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.services.eventstore.models import Event
from sentry.types.actor import Actor


@region_silo_endpoint
class EventOwnersEndpoint(EventEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project, event: Event) -> Response:
        """
        Retrieve suggested owners information for an event
        ``````````````````````````````````````````````````

        :pparam string project_id_or_slug: the id or slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event.
        :auth: required
        """
        owners, rules = ProjectOwnership.get_owners(project.id, event.data)

        serialized_owners = serialize(Actor.resolve_many(owners), request.user, ActorSerializer())

        # Make sure the serialized owners are in the correct order
        ordered_owners = []
        owner_by_id = {(o["id"], o["type"]): o for o in serialized_owners}
        for o in owners:
            key = (str(o.id), "team" if o.is_team else "user")
            if owner_by_id.get(key):
                ordered_owners.append(owner_by_id[key])

        return Response(
            {
                "owners": ordered_owners,
                # TODO(mattrobenolt): We need to change the API here to return
                # all rules, just keeping this way currently for API compat
                "rule": rules[0].matcher if rules else None,
                "rules": rules or [],
            }
        )
