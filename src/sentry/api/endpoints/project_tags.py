from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Environment


class ProjectTagsEndpoint(ProjectEndpoint, EnvironmentMixin):
    def get(self, request, project):
        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            tag_keys = []
        else:
            tag_keys = sorted(
                tagstore.get_tag_keys(
                    project.id,
                    environment_id,
                ),
                key=lambda x: x.key)

        data = []
        for tag_key in tag_keys:
            data.append(
                {
                    'id': six.text_type(tag_key.id),
                    'key': tagstore.get_standardized_key(tag_key.key),
                    'name': tagstore.get_tag_key_label(tag_key.key),
                    'uniqueValues': tag_key.values_seen,
                }
            )

        return Response(data)
