from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry import tagstore
from sentry.api.bases.project import ProjectEndpoint


class ProjectTagsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        tag_keys = tagstore.get_tag_keys(project.id)

        data = []
        for tag_key in tag_keys:
            data.append(
                {
                    'id': six.text_type(tag_key.id),
                    'key': tagstore.get_standardized_key(tag_key.key),
                    'name': tag_key.get_label(),
                    'uniqueValues': tag_key.values_seen,
                }
            )

        return Response(data)
