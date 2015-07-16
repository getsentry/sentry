from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import GroupTagValue, TagValue


@register(GroupTagValue)
class GroupTagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        assert len(set(i.key for i in item_list)) < 2

        tagvalues = dict(
            (t.value, t)
            for t in TagValue.objects.filter(
                project=item_list[0].project,
                key=item_list[0].key,
                value__in=[i.value for i in item_list]
            )
        )

        result = {}
        for item in item_list:
            result[item] = {
                'name': tagvalues[item.value].get_label(),
            }
        return result

    def serialize(self, obj, attrs, user):
        d = {
            'name': attrs['name'],
            'key': obj.key,
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }
        return d
