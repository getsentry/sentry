from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Mapping

from django.conf import settings
from django.db import IntegrityError, models
from django.db.models import Q, QuerySet
from django.utils import timezone

from sentry import analytics
from sentry.db.models import (
    ArrayField,
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    control_silo_with_replication_model,
    region_silo_only_model,
)
from sentry.db.models.fields.jsonfield import JSONField
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import User

logger = logging.getLogger(__name__)


# TODO(dcramer): pull in enum library
class IdentityStatus:
    UNKNOWN = 0
    VALID = 1
    INVALID = 2


@control_silo_with_replication_model
class IdentityProvider(Model):
    """
    An IdentityProvider is an instance of a provider.

    The IdentityProvider is unique on the type of provider (eg github, slack,
    google, etc).

    A SAML identity provide might look like this, type: onelogin, instance:
    acme-org.onelogin.com.
    """

    __include_in_export__ = False

    type = models.CharField(max_length=64)
    config = JSONField()
    date_added = models.DateTimeField(default=timezone.now, null=True)
    external_id = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_identityprovider"
        unique_together = (("type", "external_id"),)

    def get_provider(self):
        from sentry.identity import get

        return get(self.type)


class IdentityManager(BaseManager):
    def get_identities_for_user(self, user: User, provider: ExternalProviders) -> QuerySet:
        return self.filter(user_id=user.id, idp__type=provider.name)

    def has_identity(self, user: User, provider: ExternalProviders) -> bool:
        return self.get_identities_for_user(user, provider).exists()

    def link_identity(
        self,
        user: User,
        idp: IdentityProvider,
        external_id: str,
        should_reattach: bool = True,
        defaults: Mapping[str, Any | None] = None,
    ) -> Identity:
        """
        Link the user with the identity. If `should_reattach` is passed, handle
        the case where the user is linked to a different identity or the
        identity is linked to a different user.
        """
        defaults = {
            **(defaults or {}),
            "status": IdentityStatus.VALID,
            "date_verified": timezone.now(),
        }
        try:
            identity, created = self.get_or_create(
                idp=idp, user=user, external_id=external_id, defaults=defaults
            )
            if not created:
                identity.update(**defaults)
        except IntegrityError as e:
            if not should_reattach:
                raise e
            return self.reattach(idp, external_id, user, defaults)

        analytics.record(
            "integrations.identity_linked",
            provider="slack",
            actor_id=user.actor_id,
            actor_type="user",
        )
        return identity

    def delete_identity(self, user: User, idp: IdentityProvider, external_id: str) -> None:
        self.filter(Q(external_id=external_id) | Q(user=user), idp=idp).delete()
        logger.info(
            "deleted-identity",
            extra={"external_id": external_id, "idp_id": idp.id, "user_id": user.id},
        )

    def create_identity(
        self,
        idp: IdentityProvider,
        external_id: str,
        user: User,
        defaults: Mapping[str, Any],
    ) -> Identity:
        identity_model = self.create(idp=idp, user=user, external_id=external_id, **defaults)
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

    def reattach(
        self,
        idp: IdentityProvider,
        external_id: str,
        user: User,
        defaults: Mapping[str, Any],
    ) -> Identity:
        """
        Removes identities under `idp` associated with either `external_id` or `user`
        and creates a new identity linking them.
        """
        self.delete_identity(user=user, idp=idp, external_id=external_id)
        return self.create_identity(user=user, idp=idp, external_id=external_id, defaults=defaults)

    def update_external_id_and_defaults(
        self,
        idp: IdentityProvider,
        external_id: str,
        user: User,
        defaults: Mapping[str, Any],
    ) -> Identity:
        """
        Updates the identity object for a given user and identity provider
        with the new external id and other fields related to the identity status
        """
        query = self.filter(user=user, idp=idp)
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


@region_silo_only_model
class Identity(Model):
    """
    A verified link between a user and a third party identity.
    """

    __include_in_export__ = False

    idp = FlexibleForeignKey("sentry.IdentityProvider")
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    external_id = models.TextField()
    data = JSONField()
    status = BoundedPositiveIntegerField(default=IdentityStatus.UNKNOWN)
    scopes = ArrayField()
    date_verified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    objects = IdentityManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_identity"
        unique_together = (("idp", "external_id"), ("idp", "user"))

    def get_provider(self):
        from sentry.identity import get

        return get(self.idp.type)
