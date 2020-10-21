from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import RepositoryProjectPathConfig


@register(RepositoryProjectPathConfig)
class RepositoryProjectPathConfigSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "project": obj.project.slug,
            "repo": obj.repository.name,
            "stackRoot": obj.stack_root,
            "sourceRoot": obj.source_root,
            "organizationIntegration": six.text_type(obj.organization_integration_id),
            "defaultBranch": obj.default_branch,
        }
