from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseRedirect

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Project, Event, EventMapping
from sentry.web.frontend.base import OrganizationView


class OrganizationEventIdView(OrganizationView):

    def handle(self, request, organization, event_id):
        # Largely copied from ProjectGroupIndexEndpoint

        if len(event_id) != 32:
            return HttpResponse({'detail': 'Event ID must be 32 characters.'}, status=400)

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
            return HttpResponseRedirect(reverse(
                'sentry-group', args=[organization.slug, project_slugs_by_id[event_mapping.project_id], event_mapping.group_id]))

        return HttpResponseRedirect(reverse(
            'sentry-group', args=[organization.slug, project_slugs_by_id[event.project_id], event.group_id]))
