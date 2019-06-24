from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Build, Project


@register(Build)
class BuildSerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer): assert on relations
        projects = {
            d['id']: d for d in serialize(
                list(
                    Project.objects.filter(
                        id__in=[
                            i.project_id for i in item_list])),
                user)}

        return {
            item: {
                'project': projects[six.text_type(item.project_id)] if item.project_id else None,
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.guid),
            'buildId': obj.build_id,
            'newIssues': obj.new_issues,
            'totalIssues': obj.total_issues,
            'totalEvents': obj.total_events,
            'status': obj.get_status_display(),
            'name': obj.name,
            'dateCreated': obj.date_added,
            'project': attrs['project'],
        }
