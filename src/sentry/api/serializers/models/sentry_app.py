from typing import Any, List

from sentry.api.serializers import Serializer, register, serialize
from sentry.app import env
from sentry.auth.superuser import is_active_superuser
from sentry.constants import SentryAppStatus
from sentry.models import IntegrationFeature, SentryApp, SentryAppAvatar, User
from sentry.models.integrations.integration_feature import IntegrationTypes
from sentry.models.integrations.sentry_app import MASKED_VALUE
from sentry.services.hybrid_cloud.organization import organization_service


@register(SentryApp)
class SentryAppSerializer(Serializer):
    def get_attrs(self, item_list: List[SentryApp], user: User, **kwargs: Any):
        # Get associated IntegrationFeatures
        app_feature_attrs = IntegrationFeature.objects.get_by_targets_as_dict(
            targets=item_list, target_type=IntegrationTypes.SENTRY_APP
        )

        # Get associated SentryAppAvatars
        app_avatar_attrs = SentryAppAvatar.objects.get_by_apps_as_dict(sentry_apps=item_list)
        organizations = {
            o.id: o
            for o in organization_service.get_organizations(
                user_id=None,
                scope=None,
                only_visible=False,
                organization_ids=[i.owner_id for i in item_list if i.owner_id is not None],
            )
        }

        return {
            item: {
                "features": app_feature_attrs.get(item.id, set()),
                "avatars": app_avatar_attrs.get(item.id, set()),
                "owner": organizations.get(item.owner_id, None),
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user, access):
        from sentry.sentry_apps.apps import consolidate_events

        data = {
            "allowedOrigins": obj.application.get_allowed_origins(),
            "author": obj.author,
            "avatars": serialize(attrs.get("avatars"), user),
            "events": consolidate_events(obj.events),
            "featureData": [],
            "isAlertable": obj.is_alertable,
            "name": obj.name,
            "overview": obj.overview,
            "popularity": obj.popularity,
            "redirectUrl": obj.redirect_url,
            "schema": obj.schema,
            "scopes": obj.get_scopes(),
            "slug": obj.slug,
            "status": obj.get_status_display(),
            "uuid": obj.uuid,
            "verifyInstall": obj.verify_install,
            "webhookUrl": obj.webhook_url,
        }

        if obj.status != SentryAppStatus.INTERNAL:
            data["featureData"] = [serialize(x, user) for x in attrs.get("features")]

        if obj.status == SentryAppStatus.PUBLISHED and obj.date_published:
            data.update({"datePublished": obj.date_published})

        owner = attrs["owner"]

        user_orgs = organization_service.get_organizations(
            user_id=user.id, scope=None, only_visible=False, organization_ids=None
        )
        user_org_ids = {uo.id for uo in user_orgs}

        if owner:
            if (env.request and is_active_superuser(env.request)) or (
                hasattr(user, "get_orgs") and owner.id in user_org_ids
            ):
                client_secret = (
                    obj.application.client_secret if obj.show_auth_info(access) else MASKED_VALUE
                )
                data.update(
                    {
                        "clientId": obj.application.client_id,
                        "clientSecret": client_secret,
                        "owner": {"id": owner.id, "slug": owner.slug},
                    }
                )

        return data
