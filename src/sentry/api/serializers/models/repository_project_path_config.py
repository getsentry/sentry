from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.models.integration import serialize_provider
from sentry.models import RepositoryProjectPathConfig


@register(RepositoryProjectPathConfig)
class RepositoryProjectPathConfigSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        integration = obj.organization_integration.integration
        provider = integration.get_provider()
        return {
            "id": six.text_type(obj.id),
            "projectId": six.text_type(obj.project_id),
            "projectSlug": obj.project.slug,
            "repoId": six.text_type(obj.repository.id),
            "repoName": obj.repository.name,
            "integrationId": six.text_type(integration.id),
            "provider": serialize_provider(provider),
            "stackRoot": obj.stack_root,
            "sourceRoot": obj.source_root,
            "defaultBranch": obj.default_branch,
        }
