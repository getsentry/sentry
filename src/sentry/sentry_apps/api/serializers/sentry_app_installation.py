from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from typing import Annotated, Any, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.constants import SentryAppInstallationStatus
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class SentryAppInstallationAppResult(TypedDict):
    uuid: Annotated[str, ApiDescription("UUID of the custom integration")]
    slug: Annotated[str, ApiDescription("Slug of the custom integration")]
    sentryAppId: Annotated[int, ApiDescription("ID of the custom integration")]


class SentryAppInstallationOrganizationResult(TypedDict):
    slug: Annotated[str, ApiDescription("Slug of the organization the integration is installed in")]
    id: Annotated[int, ApiDescription("ID of the organization the integration is installed in")]


class SentryAppInstallationResult(TypedDict):
    app: Annotated[
        SentryAppInstallationAppResult, ApiDescription("Custom integration that's installed")
    ]
    organization: Annotated[
        SentryAppInstallationOrganizationResult,
        ApiDescription("Organization the integration is installed in"),
    ]
    uuid: Annotated[str, ApiDescription("UUID of the installation")]
    status: Annotated[
        str, ApiDescription("Status of the installation, such as pending or installed")
    ]
    code: NotRequired[
        Annotated[
            str,
            ApiDescription(
                "OAuth grant code for the installation. Only included for callers with the org:integrations scope"
            ),
        ]
    ]


@register(SentryAppInstallation)
class SentryAppInstallationSerializer(Serializer[SentryAppInstallationResult]):
    def get_attrs(
        self,
        item_list: Sequence[SentryAppInstallation],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Any, Any]:
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

    def serialize(
        self,
        obj: SentryAppInstallation,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> SentryAppInstallationResult:
        access = kwargs.get("access")
        data: SentryAppInstallationResult = {
            "app": {
                "uuid": attrs["sentry_app"].uuid,
                "slug": attrs["sentry_app"].slug,
                "sentryAppId": attrs["sentry_app"].id,
            },
            "organization": {"slug": attrs["organization"].slug, "id": attrs["organization"].id},
            "uuid": obj.uuid,
            "status": SentryAppInstallationStatus.as_str(obj.status),
        }

        is_webhook = "is_webhook" in kwargs and kwargs["is_webhook"]

        if obj.api_grant and ((access and access.has_scope("org:integrations")) or is_webhook):
            data["code"] = obj.api_grant.code

        return data
