from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer
from sentry.hybridcloud.services.organization_mapping import (
    RpcOrganizationMapping,
    organization_mapping_service,
)
from sentry.sentry_apps.api.utils.webhook_requests import BufferedRequest
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.sentry_apps.webhooks import TIMEOUT_STATUS_CODE


class _BufferedRequestAttrs(TypedDict):
    organization: RpcOrganizationMapping | None


class OrganizationResponse(TypedDict):
    name: str
    slug: str
    id: int


class SentryAppWebhookRequestSerializerResponse(TypedDict):
    webhookUrl: str
    sentryAppSlug: str
    eventType: str
    date: str
    responseCode: int
    organization: NotRequired[OrganizationResponse]
    project_id: NotRequired[int | None]
    error_id: NotRequired[str | None]
    request_body: NotRequired[str | None]
    request_headers: NotRequired[Mapping[str, str] | None]
    response_body: NotRequired[str | None]


class SentryAppWebhookRequestSerializer(Serializer):
    def __init__(self, sentry_app: SentryApp) -> None:
        self.sentry_app = sentry_app

    def get_attrs(
        self,
        item_list: Sequence[BufferedRequest],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[BufferedRequest, _BufferedRequestAttrs]:
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
        self,
        obj: BufferedRequest,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> SentryAppWebhookRequestSerializerResponse:
        organization = attrs.get("organization")
        response_code = obj.data.response_code

        data: SentryAppWebhookRequestSerializerResponse = {
            "webhookUrl": obj.data.webhook_url,
            "sentryAppSlug": self.sentry_app.slug,
            "eventType": obj.data.event_type,
            "date": obj.data.date,
            "responseCode": response_code,
        }

        if response_code >= 400 or response_code == TIMEOUT_STATUS_CODE:
            # add error data to display in Sentry app dashboard
            data.update(
                {
                    "project_id": obj.data.project_id,
                    "error_id": obj.data.error_id,
                    "request_body": obj.data.request_body,
                    "request_headers": obj.data.request_headers,
                    "response_body": obj.data.response_body,
                }
            )

        if organization:
            data["organization"] = {
                "name": organization.name,
                "id": organization.id,
                "slug": organization.slug,
            }

        return data
