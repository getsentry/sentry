from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import Project, Event, EventMapping
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ResolveEventId')
def resolve_event_id_scenario(runner):
    event = Event.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/organizations/%s/eventids/%s/' % (runner.org.slug, event.event_id, )
    )


class EventIdLookupEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    @attach_scenarios([resolve_event_id_scenario])
    def get(self, request, organization, event_id):
        """
        Resolve a Event ID
        ``````````````````

        This resolves a event ID to the project slug and internal issue ID and internal event ID.

        :pparam string organization_slug: the slug of the organization the
                                          event ID should be looked up in.
        :param string event_id: the event ID to look up.
        :auth: required

        Return:
            organizationSlug
            projectSlug
            groupId
            eventId (optional)
        """

        # Largely copied from ProjectGroupIndexEndpoint
        if len(event_id) != 32:
            return Response({'detail': 'Event ID must be 32 characters.'}, status=400)

        project_slugs_by_id = dict(
            Project.objects.filter(
                organization=organization).values_list(
                'id', 'slug'))

        try:
            event = Event.objects.filter(event_id=event_id,
                                         project_id__in=project_slugs_by_id.keys())[0]
        except IndexError:
            try:
                event_mapping = EventMapping.objects.filter(event_id=event_id,
                                                            project_id__in=project_slugs_by_id.keys())[0]

            except IndexError:
                raise ResourceDoesNotExist()

            return Response(
                {
                    'organizationSlug': organization.slug,
                    'projectSlug': project_slugs_by_id[event_mapping.project_id],
                    'groupId': six.text_type(event_mapping.group_id),
                }
            )

        return Response(
            {
                'organizationSlug': organization.slug,
                'projectSlug': project_slugs_by_id[event.project_id],
                'groupId': six.text_type(event.group_id),
                'eventId': six.text_type(event.id)
            }
        )
