from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any, cast

from django.contrib.auth.models import AnonymousUser

from sentry import options
from sentry.api.serializers import register
from sentry.api.serializers.base import Serializer
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration.service import integration_service
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

# Serializer for External Issues Model
# Maps an external issue to to additional integration information such as key or name
ExternalIssueResponse = dict[str, Any]


@register(ExternalIssue)
class ExternalIssueSerializer(Serializer[ExternalIssueResponse]):
    def get_attrs(
        self,
        item_list: Sequence[ExternalIssue],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Any, Any]:
        result: dict[ExternalIssue, dict[str, object]] = {}
        for item in item_list:
            # Get the integration (e.g. Jira, GitHub, etc) associated with that issue
            integration = integration_service.get_integration(
                integration_id=item.integration_id,
                using_replica=options.get("integration_service.get_integration.using_replica"),
            )
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

    def serialize(
        self,
        obj: ExternalIssue,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return cast(dict[str, Any], attrs)
