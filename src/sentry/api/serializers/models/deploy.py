from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Deploy, Environment


@register(Deploy)
class DeploySerializer(Serializer):
    def get_attrs(self, item_list, user, *args, **kwargs):
        environments = {
            e.id: e
            for e in Environment.objects.filter(
                id__in=[d.environment_id for d in item_list],
            )
        }

        result = {}
        for item in item_list:
            result[item] = {
                'environment': environments.get(item.environment_id),
            }

        return result

    def serialize(self, obj, attrs, user, *args, **kwargs):
        return {
            'environment': attrs.get('environment'),
            'dateStarted': obj.date_started,
            'dateFinished': obj.date_finished,
            'name': obj.name,
            'url': obj.url,
            'environment': getattr(attrs.get('environment'), 'name', None),
        }
