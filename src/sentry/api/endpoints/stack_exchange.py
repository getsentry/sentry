from __future__ import absolute_import
import six

from rest_framework.response import Response

from sentry import options
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Event, SnubaEvent


class StackExchangeEndpoint(ProjectEndpoint):

    def get(self, request, project, event_id):
        # TODO: add docstrings

        use_snuba = options.get('snuba.events-queries.enabled')

        event_cls = SnubaEvent if use_snuba else Event

        event = event_cls.objects.from_event_id(event_id, project.id)
        if event is None:
            return Response({'detail': 'Event not found'}, status=404)

        for interface in six.itervalues(event.interfaces):

            if not hasattr(interface, 'to_string'):
                continue

            interface_string = interface.to_string(event)

            # capture the first line

            interface_strings = interface_string.splitlines()

            if len(interface_strings) <= 0:
                continue

            interface_string = interface_strings[0].strip()

            if not interface_string:
                return Response({'detail': 'No results'}, status=404)

            import logging
            logging.info("interface_string: %s", interface_string)

            return Response({
                'query': interface_string,
            }, status=200)

        # unable to generate a query
        return Response({'detail': 'No available query'}, status=404)
