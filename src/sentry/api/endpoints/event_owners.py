from rest_framework.response import Response

from sentry import eventstore
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.models import ActorTuple, ProjectOwnership, Team


class EventOwnersEndpoint(ProjectEndpoint):
    def get(self, request, project, event_id):
        """
        Retrieve suggested owners information for an event
        ``````````````````````````````````````````````````

        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the id of the event.
        :auth: required
        """
        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        owners, rules = ProjectOwnership.get_owners(project.id, event.data)

        # For sake of the API, we don't differentiate between
        # the implicit "everyone" and no owners
        if owners == ProjectOwnership.Everyone:
            owners = []

        serialized_owners = serialize(
            ActorTuple.resolve_many(owners), request.user, ActorSerializer()
        )

        # Make sure the serialized owners are in the correct order
        ordered_owners = []
        owner_by_id = {(o["id"], o["type"]): o for o in serialized_owners}
        for o in owners:
            key = (str(o.id), "team" if o.type == Team else "user")
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
