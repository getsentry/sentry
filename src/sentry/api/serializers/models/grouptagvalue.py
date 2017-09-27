from __future__ import absolute_import

import operator
import six

from django.db.models import Q
from six.moves import reduce

from sentry import tagstore
from sentry.api.serializers import Serializer, register
from sentry.models import GroupTagValue, TagValue


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
        project_id = item_list[0].project_id

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
        other_lookups = [Q(key=i.key, value=i.value) for i in item_list if i.key != 'sentry:user']
        if other_lookups:
            tag_labels.update(
                {
                    (t.key, t.value): t.get_label()
                    for t in TagValue.objects.filter(
                        reduce(operator.or_, other_lookups),
                        project_id=project_id,
                    )
                }
            )

        result = {}
        for item in item_list:
            if item.key == 'sentry:user':
                if item.value.startswith('id:'):
                    label = item.value[len('id:'):]
                elif item.value.startswith('email:'):
                    label = item.value[len('email:'):]
                elif item.value.startswith('username:'):
                    label = item.value[len('username:'):]
                elif item.value.startswith('ip:'):
                    label = item.value[len('ip:'):]
                else:
                    label = item.value
            else:
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
            'key': tagstore.get_standardized_key(obj.key),
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }
