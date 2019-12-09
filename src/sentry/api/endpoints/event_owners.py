from __future__ import absolute_import

import logging

from rest_framework.response import Response

from sentry import eventstore
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.fields.actor import Actor
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.models import ProjectOwnership

logger = logging.getLogger(__name__)


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

        # populate event data
        event.bind_node_data()

        owners, rules = ProjectOwnership.get_owners(project.id, event.data)

        # For sake of the API, we don't differentiate between
        # the implicit "everyone" and no owners
        if owners == ProjectOwnership.Everyone:
            owners = []

        serialized_owners = serialize(Actor.resolve_many(owners), request.user, ActorSerializer())
        # We do so many dict/set casts on these owners that the order is not preserved at all.
        # Re-order the results according to how the rules are ordered.
        owner_map = {o["name"]: o for o in serialized_owners}
        ordered_owners = []
        for rule in rules:
            for o in rule.owners:
                found = owner_map.get(o.identifier)
                if found:
                    ordered_owners.append(found)

        if len(serialized_owners) != len(ordered_owners):
            logger.error(
                "unexpected owners in response",
                extra={
                    "project_id": project.id,
                    "event_id": event_id,
                    "expected_length": len(ordered_owners),
                    "calculated_length": len(serialized_owners),
                },
            )

        return Response(
            {
                "owners": ordered_owners,
                "rule": rules[0].matcher if rules else None,
                "rules": rules or [],
            }
        )
