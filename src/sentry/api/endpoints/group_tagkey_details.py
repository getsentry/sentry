from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import GroupTagValue, TagKey, TagKeyStatus


class GroupTagKeyDetailsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group, key):
        """
        List a tag's details

        Returns details about the given tag key.

            {method} {path}

        """
        try:
            tag_key = TagKey.objects.get(
                project=group.project_id,
                key=key,
                status=TagKeyStatus.VISIBLE,
            )
        except TagKey.DoesNotExist:
            raise ResourceDoesNotExist

        total_values = GroupTagValue.get_value_count(group.id, key)

        data = {
            'id': str(tag_key.id),
            'key': tag_key.key,
            'name': tag_key.get_label(),
            'uniqueValues': tag_key.values_seen,
            'totalValues': total_values,
        }

        return Response(data)
