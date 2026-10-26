from django.http import HttpRequest

from sentry.api.serializers.models.auth import (
    AuthSuccessSerializerResponse,
    serialize_auth_success,
)
from sentry.users.models.user import User
from sentry.utils import auth
from sentry.web.frontend.base import determine_active_organization


def get_auth_success_payload(request: HttpRequest, user: User) -> AuthSuccessSerializerResponse:
    active_organization = determine_active_organization(request)
    default_redirect = auth.get_org_redirect_url(
        request, active_organization.organization if active_organization else None
    )

    return serialize_auth_success(user, auth.get_login_redirect(request, default_redirect))
