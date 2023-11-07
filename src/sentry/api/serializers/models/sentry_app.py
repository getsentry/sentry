from typing import Any, List, Mapping

from sentry.api.serializers import Serializer, register, serialize
from sentry.app import env
from sentry.auth.superuser import is_active_superuser
from sentry.constants import SentryAppStatus
from sentry.models.apiapplication import ApiApplication
from sentry.models.avatars.sentry_app_avatar import SentryAppAvatar
from sentry.models.integrations.integration_feature import IntegrationFeature, IntegrationTypes
from sentry.models.integrations.sentry_app import MASKED_VALUE, SentryApp
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization_mapping import organization_mapping_service
from sentry.services.hybrid_cloud.user.service import user_service


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

    def serialize(self, obj, attrs, user, access):
        from sentry.sentry_apps.apps import consolidate_events

        application = attrs["application"]

        data = {
            "allowedOrigins": application.get_allowed_origins(),
            "author": obj.author,
            "avatars": serialize(attrs.get("avatars"), user),
            "events": consolidate_events(obj.events),
            "featureData": [],
            "isAlertable": obj.is_alertable,
            "metadata": obj.metadata,
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
        user_org_ids = attrs["user_org_ids"]

        if owner:
            if (env.request and is_active_superuser(env.request)) or owner.id in user_org_ids:
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
