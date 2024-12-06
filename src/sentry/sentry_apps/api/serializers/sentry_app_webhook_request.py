from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from sentry.api.serializers import Serializer
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.sentry_apps.api.utils.webhook_requests import BufferedRequest
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class SentryAppWebhookRequestSerializer(Serializer):
    def __init__(self, sentry_app: SentryApp) -> None:
        self.sentry_app = sentry_app

    def get_attrs(
        self, item_list: Sequence[BufferedRequest], user: User | RpcUser, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        organization_ids = {item.data.organization_id for item in item_list}
        organizations = organization_mapping_service.get_many(organization_ids=organization_ids)
        organizations_by_id = {organization.id: organization for organization in organizations}

        return {
            item: {
                "organization": (
                    organizations_by_id.get(item.data.organization_id)
                    if item.data.organization_id
                    else None
                )
            }
            for item in item_list
        }

    def serialize(
        self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> Mapping[str, Any]:
        organization = attrs.get("organization")
        response_code = obj.data.response_code

        data = {
            "webhookUrl": obj.data.webhook_url,
            "sentryAppSlug": self.sentry_app.slug,
            "eventType": obj.data.event_type,
            "date": obj.data.date,
            "responseCode": response_code,
        }

        if organization:
            data["organization"] = {"name": organization.name, "slug": organization.slug}

        return data
