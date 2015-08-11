from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Release, TagValue


@register(Release)
class ReleaseSerializer(Serializer):
    def get_attrs(self, item_list, user):
        tags = {
            tk.value: tk
            for tk in TagValue.objects.filter(
                project=item_list[0].project,
                key='sentry:release',
                value__in=[o.version for o in item_list],
            )
        }
        result = {}
        for item in item_list:
            result[item] = {
                'tag': tags.get(item.version),
            }
        return result

    def serialize(self, obj, attrs, user):
        d = {
            'version': obj.version,
            'shortVersion': obj.short_version,
            'ref': obj.ref,
            'url': obj.url,
            'dateStarted': obj.date_started,
            'dateReleased': obj.date_released,
            'dateCreated': obj.date_added,
            'data': obj.data,
            'newGroups': obj.new_groups,
        }
        if attrs['tag']:
            d.update({
                'lastEvent': attrs['tag'].last_seen,
                'firstEvent': attrs['tag'].first_seen,
            })
        else:
            d.update({
                'lastEvent': None,
                'firstEvent': None,
            })
        return d
