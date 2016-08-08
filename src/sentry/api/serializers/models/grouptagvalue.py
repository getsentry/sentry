from __future__ import absolute_import

import operator
import six

from django.db.models import Q
from six.moves import reduce

from sentry.api.serializers import Serializer, register
from sentry.models import EventUser, GroupTagValue, TagKey, TagValue


def parse_user_tag(value):
    lookup, value = value.split(':', 1)
    if lookup == 'id':
        lookup = 'ident'
    elif lookup == 'ip':
        lookup = 'ip_address'
    elif lookup not in ('email', 'ip_address', 'username'):
        raise ValueError('{} is not a valid user attribute'.format(lookup))
    return {lookup: value}


@register(GroupTagValue)
class GroupTagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        project = item_list[0].project

        user_lookups = []
        for item in item_list:
            if item.key != 'sentry:user':
                continue
            if ':' not in item.value:
                continue
            try:
                user_lookups.append(Q(**parse_user_tag(item.value)))
            except ValueError:
                continue

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
            'id': six.text_type(obj.id),
            'name': attrs['name'],
            'key': TagKey.get_standardized_key(obj.key),
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }
