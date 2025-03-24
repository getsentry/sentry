from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from sentry.api.serializers import Serializer, register, serialize
from sentry.app import env
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.constants import SentryAppStatus
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.integrations.models.integration_feature import IntegrationFeature, IntegrationTypes
from sentry.models.apiapplication import ApiApplication
from sentry.organizations.services.organization import organization_service
from sentry.sentry_apps.api.serializers.sentry_app_avatar import (
    SentryAppAvatarSerializer as ResponseSentryAppAvatarSerializer,
)
from sentry.sentry_apps.api.serializers.sentry_app_avatar import SentryAppAvatarSerializerResponse
from sentry.sentry_apps.models.sentry_app import MASKED_VALUE, SentryApp
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


class OwnerResponseField(TypedDict):
    id: int
    slug: str


class SentryAppSerializerResponse(TypedDict):
    allowedOrigins: list[str]
    avatars: list[SentryAppAvatarSerializerResponse]
    events: set[str]
    featureData: list[str]
    isAlertable: bool
    metadata: str
    name: str
    schema: str
    scopes: list[str]
    slug: str
    status: str
    uuid: str
    verifyInstall: bool

    # Optional fields
    author: NotRequired[str | None]
    overview: NotRequired[str | None]
    popularity: NotRequired[int | None]
    redirectUrl: NotRequired[str | None]
    webhookUrl: NotRequired[str | None]
    clientSecret: NotRequired[str | None]
    datePublished: NotRequired[datetime]
    clientId: NotRequired[str]
    owner: NotRequired[OwnerResponseField]


@register(SentryApp)
class SentryAppSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[SentryApp], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ):
        # Get associated IntegrationFeatures
        app_feature_attrs = IntegrationFeature.objects.get_by_targets_as_dict(
            targets=item_list, target_type=IntegrationTypes.SENTRY_APP
        )

        # Get associated SentryAppAvatars
        app_avatar_attrs = SentryAppAvatar.objects.get_by_apps_as_dict(sentry_apps=item_list)
        organizations = {
            o.id: o
            for o in organization_mapping_service.get_many(
                organization_ids=[i.owner_id for i in item_list if i.owner_id is not None]
            )
        }
        applications: Mapping[int, ApiApplication] = {
            app.id: app
            for app in ApiApplication.objects.filter(id__in=[i.application_id for i in item_list])
        }

        user_orgs = user_service.get_organizations(user_id=user.id)
        user_org_ids = {uo.id for uo in user_orgs}

        return {
            item: {
                "features": app_feature_attrs.get(item.id, set()),
                "avatars": app_avatar_attrs.get(item.id, set()),
                "owner": organizations.get(item.owner_id, None),
                "application": applications.get(item.application_id, None),
                "user_org_ids": user_org_ids,
            }
            for item in item_list
        }

    def serialize(
        self,
        obj: SentryApp,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> SentryAppSerializerResponse:
        from sentry.sentry_apps.logic import consolidate_events

        application = attrs["application"]

        data = SentryAppSerializerResponse(
            allowedOrigins=application.get_allowed_origins(),
            author=obj.author,
            avatars=serialize(
                objects=attrs.get("avatars"),
                user=user,
                serializer=ResponseSentryAppAvatarSerializer(),
            ),
            events=consolidate_events(obj.events),
            featureData=[],
            isAlertable=obj.is_alertable,
            metadata=obj.metadata,
            name=obj.name,
            overview=obj.overview,
            popularity=obj.popularity,
            redirectUrl=obj.redirect_url,
            schema=obj.schema,
            scopes=obj.get_scopes(),
            slug=obj.slug,
            status=obj.get_status_display(),
            uuid=obj.uuid,
            verifyInstall=obj.verify_install,
            webhookUrl=obj.webhook_url,
        )

        if obj.status != SentryAppStatus.INTERNAL:
            data["featureData"] = [serialize(x, user) for x in attrs.get("features", [])]

        if obj.status == SentryAppStatus.PUBLISHED and obj.date_published:
            data.update({"datePublished": obj.date_published})

        owner = attrs["owner"]
        user_org_ids = attrs["user_org_ids"]

        if owner:
            # TODO(schew2381): Check if superuser needs this for Sentry Apps in the UI.
            elevated_user = env.request and (
                is_active_superuser(env.request) or is_active_staff(env.request)
            )
            if elevated_user or owner.id in user_org_ids:
                is_secret_visible = obj.date_added > timezone.now() - timedelta(days=1)

                owner_context = organization_service.get_organization_by_id(
                    id=owner.id, user_id=user.id
                )

                assert obj.application, "Sentry App must have an associated ApiApplication"

                client_secret = MASKED_VALUE
                if elevated_user or (
                    owner_context
                    and owner_context.member
                    and "org:write" in owner_context.member.scopes
                    and obj.show_auth_info(owner_context.member)
                ):
                    client_secret = obj.application.client_secret

                data.update(
                    {
                        "clientId": obj.application.client_id,
                        "clientSecret": client_secret if is_secret_visible else None,
                        "owner": {"id": owner.id, "slug": owner.slug},
                    }
                )

        return data
