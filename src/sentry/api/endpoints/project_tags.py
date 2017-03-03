from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.models import TagKey, TagKeyStatus


class ProjectTagsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        tag_keys = TagKey.objects.filter(
            project=project,
            status=TagKeyStatus.VISIBLE,
        )

        data = []
        for tag_key in tag_keys:
            data.append({
                'id': six.text_type(tag_key.id),
                'key': TagKey.get_standardized_key(tag_key.key),
                'name': tag_key.get_label(),
                'uniqueValues': tag_key.values_seen,
            })

        return Response(data)
