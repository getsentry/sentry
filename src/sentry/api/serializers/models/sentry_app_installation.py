from __future__ import annotations

from typing import Any, List, MutableMapping

from sentry.api.serializers import Serializer, register
from sentry.constants import SentryAppInstallationStatus
from sentry.models import SentryAppInstallation, User
from sentry.services.hybrid_cloud.organization_mapping import organization_mapping_service
from sentry.services.hybrid_cloud.user import RpcUser


@register(SentryAppInstallation)
class SentryAppInstallationSerializer(Serializer):
    def get_attrs(
        self, item_list: List[SentryAppInstallation], user: User | RpcUser, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        result: MutableMapping[Any, Any] = super().get_attrs(item_list, user, **kwargs)

        organizations = {
            o.id: o
            for o in organization_mapping_service.get_many(
                organization_ids=list({i.organization_id for i in item_list})
            )
        }
        for item in item_list:
            result[item] = dict(organization=organizations[item.organization_id])
        return result

    def serialize(self, install, attrs, user):
        data = {
            "app": {"uuid": install.sentry_app.uuid, "slug": install.sentry_app.slug},
            "organization": {"slug": attrs["organization"].slug},
            "uuid": install.uuid,
            "status": SentryAppInstallationStatus.as_str(install.status),
        }

        if install.api_grant:
            data["code"] = install.api_grant.code

        return data
