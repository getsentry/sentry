from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.models.apiapplication import ApiApplication
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ApiApplicationSerializerResponse(TypedDict):
    id: str
    clientID: str
    clientSecret: str | None
    dateCreated: datetime
    isPublic: bool
    name: str
    homepageUrl: str | None
    privacyUrl: str | None
    termsUrl: str | None
    allowedOrigins: list[str]
    redirectUris: list[str]
    scopes: list[str]
    requiresOrgLevelAccess: bool


@register(ApiApplication)
class ApiApplicationSerializer(Serializer[ApiApplicationSerializerResponse]):
    def serialize(
        self,
        obj: ApiApplication,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser | None,
        **kwargs: object,
    ) -> ApiApplicationSerializerResponse:
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
