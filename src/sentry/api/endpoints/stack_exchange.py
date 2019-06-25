from __future__ import absolute_import
import requests

from rest_framework.response import Response

from sentry import options
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Event, SnubaEvent


STACK_EXCHANGE_SEARCH_API = 'api.stackexchange.com/2.2/search/advanced'


class StackExchangeEndpoint(ProjectEndpoint):
    # TODO(dashed): what's this? is this necessary?
    # permission_classes = (ScopedPermission, )

    def get(self, request, project, event_id):
        # TODO: add docstrings

        use_snuba = options.get('snuba.events-queries.enabled')

        event_cls = SnubaEvent if use_snuba else Event

        event = event_cls.objects.from_event_id(event_id, project.id)
        if event is None:
            return Response({'detail': 'Event not found'}, status=404)

        exception_interface = event.get_interface('exception')

        if not hasattr(exception_interface, 'to_string'):
            return Response({'detail': 'No results'}, status=404)

        exception_string = exception_interface.to_string(event)

        if not exception_string:
            return Response({'detail': 'No results'}, status=404)

        # capture the first line of the exception_string
        exception_string = exception_string.splitlines()[0].strip()

        # for interface in six.itervalues(event.interfaces):
        #     import logging
        #     logging.info("interface: %s", interface.to_string(event))
        #     exception_body = interface.to_email_html(event)

        import logging
        logging.info("exception: %s", exception_string)

        # query stackoverflow

        query_params = {
            'q': exception_string,
            'order': 'desc',
            'sort': 'votes',
            'site': 'stackoverflow',
        }

        response = requests.get('https://{}'.format(STACK_EXCHANGE_SEARCH_API), params=query_params)

        return Response(response.json(), status=200)
