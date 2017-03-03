from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import (
    GroupTagKey, GroupTagValue, TagKey, TagKeyStatus, Group
)
from sentry.utils.apidocs import scenario


@scenario('ListTagDetails')
def list_tag_details_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/issues/%s/tags/%s/' % (
            group.id, 'browser'),
    )


class GroupTagKeyDetailsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    # XXX: this scenario does not work for some inexplicable reasons
    # @attach_scenarios([list_tag_details_scenario])
    def get(self, request, group, key):
        """
        Retrieve Tag Details
        ````````````````````

        Returns details for given tag key related to an issue.

        :pparam string issue_id: the ID of the issue to retrieve.
        :pparam string key: the tag key to look the values up for.
        :auth: required
        """
        # XXX(dcramer): kill sentry prefix for internal reserved tags
        if TagKey.is_reserved_key(key):
            lookup_key = 'sentry:{0}'.format(key)
        else:
            lookup_key = key

        try:
            tag_key = TagKey.objects.get(
                project=group.project_id,
                key=lookup_key,
                status=TagKeyStatus.VISIBLE,
            )
        except TagKey.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            group_tag_key = GroupTagKey.objects.get(
                group=group,
                key=lookup_key,
            )
        except GroupTagKey.DoesNotExist:
            raise ResourceDoesNotExist

        total_values = GroupTagValue.get_value_count(group.id, lookup_key)

        top_values = GroupTagValue.get_top_values(group.id, lookup_key, limit=9)

        data = {
            'id': six.text_type(tag_key.id),
            'key': key,
            'name': tag_key.get_label(),
            'uniqueValues': group_tag_key.values_seen,
            'totalValues': total_values,
            'topValues': serialize(top_values, request.user),
        }

        return Response(data)
