from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Repository


@register(Repository)
class RepositorySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        external_slug = None
        integration_id = None
        if obj.integration_id:
            integration_id = six.text_type(obj.integration_id)
        if obj.provider:
            repo_provider = obj.get_provider()
            provider = {"id": obj.provider, "name": repo_provider.name}
            external_slug = repo_provider.repository_external_slug(obj)
        else:
            provider = {"id": "unknown", "name": "Unknown Provider"}

        return {
            "id": six.text_type(obj.id),
            "name": obj.config.get("pending_deletion_name", obj.name),
            "url": obj.url,
            "provider": provider,
            "status": obj.get_status_display(),
            "dateCreated": obj.date_added,
            "integrationId": integration_id,
            "externalSlug": external_slug,
        }
