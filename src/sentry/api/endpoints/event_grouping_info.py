from __future__ import absolute_import

import six

from django.http import HttpResponse

from sentry.api.base import Endpoint
from sentry.api.bases.group import GroupPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Event
from sentry.utils import json


class EventGroupingInfoEndpoint(Endpoint):
    permission_classes = (GroupPermission, )

    def get(self, request, event_id):
        """
        Returns the grouping information for an event
        `````````````````````````````````````````````

        This endpoint returns a JSON dump of the metadata that went into the
        grouping algorithm.
        """
        event = Event.objects.from_event_id(event_id, project_id=None)
        if event is None:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, event.group)

        Event.objects.bind_nodes([event], 'data')

        rv = {}
        hashes = event.get_hashes()

        for (key, variant) in six.iteritems(event.get_grouping_variants()):
            d = variant.as_dict()
            # Since the hashes are generated on the fly and might no
            # longer match the stored ones we indicate if the hash
            # generation caused the hash to mismatch.
            d['hashMismatch'] = d['hash'] is not None and d['hash'] not in hashes
            d['key'] = key
            rv[key] = d

        return HttpResponse(json.dumps(rv), content_type='application/json')
