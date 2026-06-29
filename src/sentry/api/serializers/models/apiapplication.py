from datetime import timedelta

from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.models.apiapplication import ApiApplication


@register(ApiApplication)
class ApiApplicationSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        is_owner = user and not user.is_anonymous and user.id == obj.owner_id
        has_user_context = user is not None and not getattr(user, "is_anonymous", True)
        # NOTE: When no user is passed, the secret remains visible to
        # preserve behavior for superuser-gated getsentry admin endpoints.
        # TODO: Remove this fallback once getsentry instance-level OAuth
        # endpoints pass request.user to serialize().
        is_secret_visible = obj.date_added > timezone.now() - timedelta(minutes=5) and (
            is_owner or not has_user_context
        )
        return {
            "id": obj.client_id,
            "clientID": obj.client_id,
            "clientSecret": obj.client_secret if is_secret_visible else None,
            "dateCreated": obj.date_added,
            "isPublic": obj.is_public,
            "name": obj.name,
            "homepageUrl": obj.homepage_url,
            "privacyUrl": obj.privacy_url,
            "termsUrl": obj.terms_url,
            "allowedOrigins": obj.get_allowed_origins(),
            "redirectUris": obj.get_redirect_uris(),
            "scopes": obj.scopes,
            "requiresOrgLevelAccess": obj.requires_org_level_access,
        }
