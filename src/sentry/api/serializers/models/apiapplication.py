from datetime import timedelta

from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.models.apiapplication import ApiApplication


@register(ApiApplication)
class ApiApplicationSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        is_secret_visible = obj.date_added > timezone.now() - timedelta(days=1)
        return {
            "id": obj.client_id,
            "clientID": obj.client_id,
            "clientSecret": obj.client_secret if is_secret_visible else None,
            "name": obj.name,
            "homepageUrl": obj.homepage_url,
            "privacyUrl": obj.privacy_url,
            "termsUrl": obj.terms_url,
            "allowedOrigins": obj.get_allowed_origins(),
            "redirectUris": obj.get_redirect_uris(),
            "scopes": obj.scopes,
            "requiresOrgLevelAccess": obj.requires_org_level_access,
        }
