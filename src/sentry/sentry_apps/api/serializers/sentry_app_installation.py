from __future__ import annotations

from collections.abc import MutableMapping, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.constants import SentryAppInstallationStatus
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


@register(SentryAppInstallation)
class SentryAppInstallationSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[SentryAppInstallation],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ):
        result: MutableMapping[Any, Any] = super().get_attrs(item_list, user, **kwargs)

        organizations = {
            o.id: o
            for o in organization_mapping_service.get_many(
                organization_ids=list({i.organization_id for i in item_list})
            )
        }
        sentry_apps = {
            sa.id: sa
            for sa in SentryApp.objects.filter(id__in=[item.sentry_app_id for item in item_list])
        }
        for item in item_list:
            result[item] = {
                "organization": organizations[item.organization_id],
                "sentry_app": sentry_apps[item.sentry_app_id],
            }
        return result

    def serialize(self, obj, attrs, user: User | RpcUser | AnonymousUser, **kwargs):
        access = kwargs.get("access")
        data = {
            "app": {"uuid": attrs["sentry_app"].uuid, "slug": attrs["sentry_app"].slug},
            "organization": {"slug": attrs["organization"].slug, "id": attrs["organization"].id},
            "uuid": obj.uuid,
            "status": SentryAppInstallationStatus.as_str(obj.status),
        }

        is_webhook = "is_webhook" in kwargs and kwargs["is_webhook"]

        if obj.api_grant and ((access and access.has_scope("org:integrations")) or is_webhook):
            data["code"] = obj.api_grant.code

        return data
