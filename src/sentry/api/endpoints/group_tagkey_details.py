from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import GroupTagValue, TagKey, TagKeyStatus


class GroupTagKeyDetailsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group, key):
        """
        List a tag's details

        Returns details about the given tag key.

            {method} {path}

        """
        # XXX(dcramer): kill sentry prefix for internal reserved tags
        if key in ('release', 'user', 'filename', 'function'):
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

        total_values = GroupTagValue.get_value_count(group.id, key)

        top_values = GroupTagValue.get_top_values(group.id, key, limit=3)

        data = {
            'key': key,
            'name': tag_key.get_label(),
            'uniqueValues': tag_key.values_seen,
            'totalValues': total_values,
            'topValues': serialize(top_values, request.user),
        }

        return Response(data)
