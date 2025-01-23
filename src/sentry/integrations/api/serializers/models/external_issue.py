from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers.base import Serializer
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration.service import integration_service
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


# Serializer for External Issues Model
# Maps an external issue to to additional integration information such as key or name
class ExternalIssueSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[ExternalIssue],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ):
        result = {}
        for item in item_list:
            # Get the integration (e.g. Jira, GitHub, etc) associated with that issue
            integration = integration_service.get_integration(integration_id=item.integration_id)
            if integration is None:
                continue
            installation = integration.get_installation(organization_id=item.organization.id)
            if hasattr(installation, "get_issue_display_name"):
                result[item] = {
                    "id": str(item.id),
                    "key": item.key,
                    "title": item.title,
                    "description": item.description,
                    "displayName": installation.get_issue_display_name(item),
                    "integrationKey": integration.provider,
                    "integrationName": integration.name,
                }

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        return attrs
