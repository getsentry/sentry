from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import RepositoryProjectPathConfig


@register(RepositoryProjectPathConfig)
class RepositoryProjectPathConfigSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "projectId": six.text_type(obj.project_id),
            "projectSlug": obj.project.slug,
            "repoId": six.text_type(obj.repository.id),
            "repoName": obj.repository.name,
            "organizationIntegrationId": six.text_type(obj.organization_integration_id),
            "stackRoot": obj.stack_root,
            "sourceRoot": obj.source_root,
            "defaultBranch": obj.default_branch,
        }
