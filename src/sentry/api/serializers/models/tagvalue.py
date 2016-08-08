from __future__ import absolute_import

import operator
import six

from django.db.models import Q
from six.moves import reduce

from sentry.api.serializers import Serializer, register
from sentry.models import EventUser, TagKey, TagValue


def parse_user_tag(value):
    lookup, value = value.split(':', 1)
    if lookup == 'id':
        lookup = 'ident'
    elif lookup == 'ip':
        lookup = 'ip_address'
    return {lookup: value}


@register(TagValue)
class TagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        user_lookups = [
            Q(**parse_user_tag(i.value))
            for i in item_list
            if i.key == 'sentry:user'
        ]

        tag_labels = {}
        if user_lookups:
            tag_labels.update({
                ('sentry:user', euser.tag_value): euser.get_label()
                for euser in EventUser.objects.filter(
                    reduce(operator.or_, user_lookups),
                    project=item_list[0].project,
                )
            })

        result = {}
        for item in item_list:
            try:
                label = tag_labels[(item.key, item.value)]
            except KeyError:
                label = item.get_label()
            result[item] = {
                'name': label,
            }
        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'key': TagKey.get_standardized_key(obj.key),
            'name': attrs['name'],
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }


class EnvironmentTagValueSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'name': obj.value,
        }
