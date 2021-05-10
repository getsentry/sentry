from django.urls import reverse
from rest_framework.response import Response

from sentry.exceptions import InvalidIdentity, PluginError
from sentry.models import Integration, OrganizationIntegration
from social_auth.models import UserSocialAuth


class ProviderMixin:
    auth_provider = None
    logger = None

    def link_auth(self, user, organization, data):
        try:
            usa = UserSocialAuth.objects.get(
                user=user, id=data["default_auth_id"], provider=self.auth_provider
            )
        except UserSocialAuth.DoesNotExist:
            raise PluginError

        integration = Integration.objects.get_or_create(
            provider=self.auth_provider, external_id=usa.uid
        )[0]
        integration.add_organization(organization, user, default_auth_id=usa.id)

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
            has_auth = OrganizationIntegration.objects.filter(
                integration__provider=self.auth_provider, organization=organization
            ).exists()
            if has_auth:
                return False

        if not user.is_authenticated:
            return True

        return not UserSocialAuth.objects.filter(user=user, provider=self.auth_provider).exists()

    def get_auth(self, user, **kwargs):
        if self.auth_provider is None:
            return None

        organization = kwargs.get("organization")
        if organization:
            try:
                auth = UserSocialAuth.objects.get(
                    id=OrganizationIntegration.objects.filter(
                        organization=organization, integration__provider=self.auth_provider
                    ).values_list("default_auth_id", flat=True)[0]
                )
            except UserSocialAuth.DoesNotExist:
                pass
            else:
                return auth

        if not user.is_authenticated:
            return None

        return UserSocialAuth.objects.filter(user=user, provider=self.auth_provider).first()

    def handle_api_error(self, e):
        context = {"error_type": "unknown"}
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
            if self.logger:
                self.logger.exception(str(e))
            status = 500
        return Response(context, status=status)
