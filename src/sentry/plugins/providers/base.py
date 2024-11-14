from __future__ import annotations

import logging

from django.urls import reverse
from rest_framework.response import Response

from sentry.exceptions import InvalidIdentity, PluginError
from sentry.integrations.services.integration import integration_service
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.usersocialauth.model import RpcUserSocialAuth
from sentry.users.services.usersocialauth.service import usersocialauth_service


class ProviderMixin:
    auth_provider: str | None = None
    logger = logging.getLogger(__name__)

    def link_auth(self, user, organization, data):
        usa = usersocialauth_service.get_one_or_none(
            filter={
                "id": data["default_auth_id"],
                "user_id": user.id,
                "provider": self.auth_provider,
            }
        )
        if not usa:
            raise PluginError

        rpc_organization = serialize_rpc_organization(org=organization)
        usersocialauth_service.link_auth(usa=usa, organization=rpc_organization)

    def get_available_auths(self, user, organization, integrations, social_auths, **kwargs):
        if self.auth_provider is None:
            return []

        social_auths_by_id = {usa.id: usa for usa in social_auths}
        linked_social_auths = set()

        auths = []
        for i in integrations:
            associated_auth = i.default_auth_id and social_auths_by_id[i.default_auth_id]
            if associated_auth:
                linked_social_auths.add(associated_auth.id)
            auths.append(
                {
                    "defaultAuthId": i.default_auth_id,
                    "user": associated_auth and {"email": associated_auth.user.email},
                    "externalId": i.external_id,
                    "integrationId": str(i.id),
                    "linked": True,
                }
            )
        auths.extend(
            [
                {
                    "defaultAuthId": sa.id,
                    "user": {"email": sa.user.email},
                    "externalId": sa.uid,
                    "integrationId": None,
                    "linked": False,
                }
                for sa in social_auths
                if sa.id not in linked_social_auths
            ]
        )
        return auths

    def get_auth_url(self, user, **kwargs):
        if self.auth_provider is None:
            return

        return reverse("socialauth_associate", args=[self.auth_provider])

    def needs_auth(self, user, **kwargs):
        """
        Return ``True`` if the authenticated user needs to associate an auth
        service before performing actions with this provider.
        """
        if self.auth_provider is None:
            return False

        organization = kwargs.get("organization")
        if organization:
            ois = integration_service.get_organization_integrations(
                providers=[self.auth_provider], organization_id=organization.id
            )
            has_auth = len(ois) > 0
            if has_auth:
                return False

        if not user.is_authenticated:
            return True

        auths = usersocialauth_service.get_many(
            filter={"user_id": user.id, "provider": self.auth_provider}
        )
        return len(auths) == 0

    def get_auth(self, user: RpcUser | User, **kwargs) -> RpcUserSocialAuth | None:
        if self.auth_provider is None:
            return None

        organization = kwargs.get("organization")
        if organization:
            ois = integration_service.get_organization_integrations(
                providers=[self.auth_provider], organization_id=organization.id
            )
            if len(ois) > 0 and ois[0].default_auth_id is not None:
                auth = usersocialauth_service.get_one_or_none(filter={"id": ois[0].default_auth_id})
                if auth:
                    return auth

        if not user.is_authenticated:
            return None
        return usersocialauth_service.get_one_or_none(
            filter={"user_id": user.id, "provider": self.auth_provider}
        )

    def handle_api_error(self, e: Exception) -> Response:
        context: dict[str, object] = {"error_type": "unknown"}
        if isinstance(e, InvalidIdentity):
            if self.auth_provider is None:
                context.update(
                    {
                        "message": "Your authentication credentials are invalid. Please check your project settings."
                    }
                )
            else:
                context.update(
                    {
                        "error_type": "auth",
                        "auth_url": reverse("socialauth_associate", args=[self.auth_provider]),
                    }
                )
            status = 400
        elif isinstance(e, PluginError):
            # TODO(dcramer): we should have a proper validation error
            context.update({"error_type": "validation", "errors": {"__all__": str(e)}})
            status = 400
        else:
            self.logger.exception(str(e))
            status = 500
        return Response(context, status=status)
