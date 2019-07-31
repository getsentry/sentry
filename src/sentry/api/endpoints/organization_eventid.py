from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry import eventstore
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Project


class EventIdLookupEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization, event_id):
        """
        Resolve a Event ID
        ``````````````````

        This resolves a event ID to the project slug and internal issue ID and internal event ID.

        :pparam string organization_slug: the slug of the organization the
                                          event ID should be looked up in.
        :param string event_id: the event ID to look up.
        :auth: required
        """
        # Largely copied from ProjectGroupIndexEndpoint
        if len(event_id) != 32:
            return Response({'detail': 'Event ID must be 32 characters.'}, status=400)

        project_slugs_by_id = dict(
            Project.objects.filter(
                organization=organization).values_list(
                'id', 'slug'))

        try:
            event = eventstore.get_events(filter_keys={
                'project_id': project_slugs_by_id.keys(),
                'event_id': event_id,
            }, limit=1)[0]
        except IndexError:
            raise ResourceDoesNotExist()
        else:
            return Response(
                {
                    'organizationSlug': organization.slug,
                    'projectSlug': project_slugs_by_id[event.project_id],
                    'groupId': six.text_type(event.group_id),
                    'eventId': six.text_type(event.id),
                    'event': serialize(
                        event,
                        request.user,
                    ),
                }
            )
