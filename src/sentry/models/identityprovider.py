import logging

from django.db import models
from django.utils import timezone

from bitfield import BitField
from sentry.db.models import (
    BoundedPositiveIntegerField,
    EncryptedJsonField,
    FlexibleForeignKey,
    Model,
)

logger = logging.getLogger(__name__)


class IdentityProvider(Model):
    """
    An IdentityProvider is an instance of a provider.

    The IdentityProvider is unique on the type of provider (eg github, slack,
    google, etc).

    A SAML identity provide might look like this, type: onelogin, instance:
    acme-org.onelogin.com.
    """

    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization", blank=True, null=True)

    type = models.CharField(max_length=64)
    external_id = models.CharField(max_length=64, null=True)
    config = EncryptedJsonField()

    date_added = models.DateTimeField(default=timezone.now, null=True)
    last_sync = models.DateTimeField(null=True)

    # To be deleted after migration
    authprovider = FlexibleForeignKey(
        "sentry.AuthProvider",
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_identityprovider"
        unique_together = (("type", "external_id"),)

    def get_provider(self):
        from sentry.identity import get

        return get(self.type)


class IdentityProviderSsoConfig(Model):
    """
    A subset of IdentityProvider is used for Single Sign-On.
    This holds the Sentry-related configs for such providers
    """

    __include_in_export__ = False

    identityprovider = FlexibleForeignKey("sentry.IdentityProvider", db_index=True)
    default_team = FlexibleForeignKey(
        "sentry.Team", blank=True, null=True, on_delete=models.SET_NULL
    )

    default_role = BoundedPositiveIntegerField(default=50)  # Default to member
    default_global_access = models.BooleanField(default=False)  # Unused

    flags = BitField(
        flags=(
            ("allow_unlinked", "Grant access to members who have not linked SSO accounts."),
            ("scim_enabled", "Enable SCIM for member and team provisioning and syncing"),
        ),
        default=0,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_identityproviderssoconfig"
