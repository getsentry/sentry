from __future__ import absolute_import

import operator

from django.db.models import Q

from sentry.api.serializers import Serializer, register
from sentry.models import EventUser, GroupTagValue, TagKey, TagValue


def parse_user_tag(value):
    lookup, value = value.split(':', 1)
    if lookup == 'id':
        lookup = 'ident'
    elif lookup == 'ip':
        lookup = 'ip_address'
    return {lookup: value}


@register(GroupTagValue)
class GroupTagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        project = item_list[0].project

        user_lookups = [
            Q(**parse_user_tag(i.value))
            for i in item_list
            if i.key == 'sentry:user'
            and ':' in i.value
        ]

        tag_labels = {}
        if user_lookups:
            tag_labels.update({
                ('sentry:user', euser.tag_value): euser.get_label()
                for euser in EventUser.objects.filter(
                    reduce(operator.or_, user_lookups),
                    project=project,
                )
            })

        other_lookups = [
            Q(key=i.key, value=i.value)
            for i in item_list
            if i.key != 'sentry:user'
        ]
        if other_lookups:
            tag_labels.update({
                (t.key, t.value): t.get_label()
                for t in TagValue.objects.filter(
                    reduce(operator.or_, other_lookups),
                    project=project,
                )
            })

        result = {}
        for item in item_list:
            try:
                label = tag_labels[(item.key, item.value)]
            except KeyError:
                label = item.value
            result[item] = {
                'name': label,
            }
        return result

    def serialize(self, obj, attrs, user):
        return {
            'name': attrs['name'],
            'key': TagKey.get_standardized_key(obj.key),
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }
