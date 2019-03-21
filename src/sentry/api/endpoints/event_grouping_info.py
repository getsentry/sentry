from __future__ import absolute_import

import six

from django.http import HttpResponse

from sentry.api.base import Endpoint
from sentry.api.bases.group import GroupPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.grouping.api import ConfigNotFoundException
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
        config_name = request.GET.get('config') or None

        # We always fetch the stored hashes here.  The reason for this is
        # that we want to show in the UI if the forced grouping algorithm
        # produced hashes that would normally also appear in the event.
        hashes = event.get_hashes()

        try:
            variants = event.get_grouping_variants(config_name)
        except ConfigNotFoundException:
            raise ResourceDoesNotExist(detail='Unknown grouping config')

        for (key, variant) in six.iteritems(variants):
            d = variant.as_dict()
            # Since the hashes are generated on the fly and might no
            # longer match the stored ones we indicate if the hash
            # generation caused the hash to mismatch.
            d['hashMismatch'] = d['hash'] is not None and d['hash'] not in hashes
            d['key'] = key
            rv[key] = d

        return HttpResponse(json.dumps(rv), content_type='application/json')
