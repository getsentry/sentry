from __future__ import absolute_import

import six

from sentry.api.serializers import (
    Serializer,
    register,
)
from sentry.incidents.models import (
    Incident,
    IncidentActivity,
)


@register(IncidentActivity)
class IncidentActivitySerializer(Serializer):
    def get_attrs(self, item_list, **kwargs):
        incidents = Incident.objects.filter(id__in=set(i.incident_id for i in item_list))
        incident_lookup = {incident.id: incident for incident in incidents}

        results = {}
        for activity in item_list:
            results[activity] = {'incident': incident_lookup[activity.incident_id]}

        return results

    def serialize(self, obj, attrs, user):
        incident = attrs['incident']
        return {
            'id': six.text_type(obj.id),
            'incidentIdentifier': six.text_type(incident.identifier),
            'userId': six.text_type(obj.user_id),
            'type': obj.type,
            'value': obj.value,
            'previousValue': obj.previous_value,
            'comment': obj.comment,
        }
