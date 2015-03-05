from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import GroupTagValue, TagKey, TagKeyStatus


class GroupTagKeyValuesEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group, key):
        """
        List a tag's values

        Return a list of values associated with this key.

            {method} {path}

        """
        try:
            tagkey = TagKey.objects.get(
                project=group.project_id,
                key=key,
                status=TagKeyStatus.VISIBLE,
            )
        except TagKey.DoesNotExist:
            raise ResourceDoesNotExist

        queryset = GroupTagValue.objects.filter(
            group=group,
            key=key,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )
