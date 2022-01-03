from typing import Any, List

from sentry.api.serializers import Serializer, register, serialize
from sentry.app import env
from sentry.auth.superuser import is_active_superuser
from sentry.constants import SentryAppStatus
from sentry.models import IntegrationFeature, SentryApp
from sentry.models.integrationfeature import IntegrationTypes
from sentry.models.sentryapp import MASKED_VALUE
from sentry.models.sentryappavatar import SentryAppAvatar
from sentry.models.user import User
from sentry.utils.compat import map


@register(SentryApp)
class SentryAppSerializer(Serializer):
    def get_attrs(self, item_list: List[SentryApp], user: User, **kwargs: Any):
        # Get associated IntegrationFeatures
        app_feature_attrs = IntegrationFeature.objects.get_by_targets_as_dict(
            targets=item_list, target_type=IntegrationTypes.SENTRY_APP
        )

        # Get associated SentryAppAvatars
        app_avatar_attrs = SentryAppAvatar.objects.get_by_apps_as_dict(sentry_apps=item_list)

        return {
            item: {
                "features": app_feature_attrs.get(item.id, set()),
                "avatars": app_avatar_attrs.get(item.id, set()),
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user, access):
        from sentry.mediators.service_hooks.creator import consolidate_events

        data = {
            "name": obj.name,
            "slug": obj.slug,
            "author": obj.author,
            "scopes": obj.get_scopes(),
            "events": consolidate_events(obj.events),
            "status": obj.get_status_display(),
            "schema": obj.schema,
            "uuid": obj.uuid,
            "webhookUrl": obj.webhook_url,
            "redirectUrl": obj.redirect_url,
            "isAlertable": obj.is_alertable,
            "verifyInstall": obj.verify_install,
            "overview": obj.overview,
            "allowedOrigins": obj.application.get_allowed_origins(),
            "popularity": obj.popularity,
        }

        data["featureData"] = []

        if obj.status != SentryAppStatus.INTERNAL:
            data["featureData"] = map(lambda x: serialize(x, user), attrs.get("features"))

        if obj.status == SentryAppStatus.PUBLISHED and obj.date_published:
            data.update({"datePublished": obj.date_published})

        if (env.request and is_active_superuser(env.request)) or (
            hasattr(user, "get_orgs") and obj.owner in user.get_orgs()
        ):
            client_secret = (
                obj.application.client_secret if obj.show_auth_info(access) else MASKED_VALUE
            )
            data.update(
                {
                    "clientId": obj.application.client_id,
                    "clientSecret": client_secret,
                    "owner": {"id": obj.owner.id, "slug": obj.owner.slug},
                }
            )

        data.update({"avatars": serialize(attrs.get("avatars"), user)})

        return data
