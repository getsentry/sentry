from __future__ import absolute_import

import six

from sentry.api.serializers import register, Serializer
from sentry.models import ProcessingIssue


@register(ProcessingIssue)
class ProcessingIssueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        counts = dict((i.id, getattr(i, 'num_groups', None))
                      for i in item_list)

        missing_counts = []
        for pk, groups in six.iteritems(counts):
            if groups is None:
                missing_counts.append(pk)

        if missing_counts:
            extra_counts = ProcessingIssue.objects.with_num_groups().filter(
                pk__in=list(missing_counts)).values('id', 'num_groups')
            for d in extra_counts:
                counts[d['id']] = d['num_groups']

        result = {}
        for item in item_list:
            result[item] = {
                'num_groups': counts.get(item.id) or 0,
            }

        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'firstSeen': obj.first_seen,
            'lastSeen': obj.last_seen,
            'affectedGroups': attrs['num_groups'],
            'type': obj.type,
            'key': obj.key,
            'data': obj.data,
        }
