import logging
from enum import Enum

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.signals import pre_save
from django.utils import timezone

from bitfield import BitField
from sentry.db.models import (
    ArrayField,
    BoundedPositiveIntegerField,
    EncryptedJsonField,
    FlexibleForeignKey,
    Model,
)

logger = logging.getLogger(__name__)


class IdentityStatus(Enum):
    UNKNOWN = 0
    VALID = 1
    INVALID = 2


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

    # To be renamed to "provider" because this is a bad column name
    type = models.CharField(max_length=64)
    # Replacing "type"
    provider = models.CharField(max_length=64, null=True)

    # To be renamed to "provider_id", because we're already renaming "type"
    external_id = models.CharField(max_length=64, null=True)
    # Replacing "external_id"
    provider_id = models.CharField(max_length=64, null=True)
    config = EncryptedJsonField()

    date_added = models.DateTimeField(default=timezone.now, null=True)

    # SSO-specific fields
    is_sso = models.BooleanField(default=False)
    sso_default_team = models.OneToOneField(
        "sentry.Team", blank=True, null=True, on_delete=models.SET_NULL
    )
    sso_default_role = BoundedPositiveIntegerField(default=0)
    sso_default_global_access = models.BooleanField(default=False)
    sso_flags = BitField(
        flags=(
            ("allow_unlinked", "Grant access to members who have not linked SSO accounts."),
            ("scim_enabled", "Enable SCIM for member and team provisioning and syncing"),
        ),
        default=0,
    )

    # To be deleted after migration
    authprovider = models.OneToOneField(
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


def handle_identity_provider_pre_save(instance, **kwargs):
    instance.provider = instance.type
    instance.provider_id = instance.external_id


pre_save.connect(
    handle_identity_provider_pre_save,
    sender="sentry.IdentityProvider",
    dispatch_uid="handle_identity_provider_pre_save",
    weak=False,
)


class Identity(Model):
    """
    A verified link between a user and a third party identity.
    """

    __include_in_export__ = False

    idp = FlexibleForeignKey("sentry.IdentityProvider")
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    external_id = models.TextField()
    data = EncryptedJsonField()
    status = BoundedPositiveIntegerField(default=IdentityStatus.UNKNOWN.value)
    scopes = ArrayField()
    date_verified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_identity"
        unique_together = (("idp", "external_id"), ("idp", "user"))

    def get_provider(self):
        from sentry.identity import get

        return get(self.idp.type)

    @classmethod
    def reattach(cls, idp, external_id, user, defaults):
        """
        Removes identities under `idp` associated with either `external_id` or `user`
        and creates a new identity linking them.
        """
        lookup = Q(external_id=external_id) | Q(user=user)
        Identity.objects.filter(lookup, idp=idp).delete()
        logger.info(
            "deleted-identity",
            extra={"external_id": external_id, "idp_id": idp.id, "user_id": user.id},
        )

        identity_model = Identity.objects.create(
            idp=idp, user=user, external_id=external_id, **defaults
        )
        logger.info(
            "created-identity",
            extra={
                "idp_id": idp.id,
                "external_id": external_id,
                "object_id": identity_model.id,
                "user_id": user.id,
            },
        )
        return identity_model

    @classmethod
    def update_external_id_and_defaults(cls, idp, external_id, user, defaults):
        """
        Updates the identity object for a given user and identity provider
        with the new external id and other fields related to the identity status
        """
        query = Identity.objects.filter(user=user, idp=idp)
        query.update(external_id=external_id, **defaults)
        identity_model = query.first()
        logger.info(
            "updated-identity",
            extra={
                "external_id": external_id,
                "idp_id": idp.id,
                "user_id": user.id,
                "identity_id": identity_model.id,
            },
        )
        return identity_model
