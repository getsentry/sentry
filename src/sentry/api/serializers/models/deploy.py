from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Deploy, Environment


@register(Deploy)
class DeploySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        environments = {
            id: name
            for id, name in Environment.objects.filter(
                id__in=[d.environment_id for d in item_list]
            ).values_list("id", "name")
        }

        result = {}
        for item in item_list:
            result[item] = {"environment": environments.get(item.environment_id)}

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": six.text_type(obj.id),
            "environment": attrs.get("environment"),
            "dateStarted": obj.date_started,
            "dateFinished": obj.date_finished,
            "name": obj.name,
            "url": obj.url,
        }
