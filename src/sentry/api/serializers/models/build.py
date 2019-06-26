from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Build, Commit, Project, User


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

        commits = {
            d['id']: d for d in serialize(
                list(
                    Commit.objects.filter(
                        organization_id=item_list[0].organization_id,
                        key__in=[i.commit_key for i in item_list])),
                user)}

        approved_by = {
            d['id']: d for d in serialize(
                list(
                    User.objects.filter(
                        is_active=True,
                        id__in=[
                            i.approved_by_id for i in item_list])),
                user)}

        return {
            item: {
                'project': projects[six.text_type(item.project_id)] if item.project_id else None,
                'commit': commits.get(item.commit_key),
                'approved_by': approved_by[six.text_type(item.approved_by_id)] if item.approved_by_id else None,
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.guid),
            'buildId': obj.build_id,
            'commit': attrs['commit'],
            'newIssues': obj.new_issues,
            'totalIssues': obj.total_issues,
            'totalEvents': obj.total_events,
            'status': obj.get_status_display(),
            'name': obj.name or 'Unknown build',
            'dateCreated': obj.date_added,
            'approvedBy': attrs['approved_by'],
            'project': attrs['project'],
        }
