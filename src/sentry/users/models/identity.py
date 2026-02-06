from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, ClassVar

from django.conf import settings
from django.contrib.postgres.fields.array import ArrayField
from django.db import IntegrityError, models, router, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from sentry import analytics
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    control_silo_model,
)
from sentry.db.models.manager.base import BaseManager
from sentry.hybridcloud.models.outbox import ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.integrations.types import ExternalProviders, IntegrationProviderSlug
from sentry.types.region import find_all_region_names
from sentry.users.services.user import RpcUser

if TYPE_CHECKING:
    from sentry.identity.base import Provider
    from sentry.identity.services.identity import RpcIdentityProvider
    from sentry.users.models.user import User

logger = logging.getLogger(__name__)


# TODO(dcramer): pull in enum library
class IdentityStatus:
    UNKNOWN = 0
    VALID = 1
    INVALID = 2


@control_silo_model
class IdentityProvider(Model):
    """
    An IdentityProvider is an instance of a provider.

    The IdentityProvider is unique on the type of provider (eg github, slack,
    google, etc).

    A SAML identity provide might look like this, type: onelogin, instance:
    acme-org.onelogin.com.
    """

    __relocation_scope__ = RelocationScope.Excluded

    type = models.CharField(max_length=64)
    config = models.JSONField(default=dict)
    date_added = models.DateTimeField(default=timezone.now, null=True)
    external_id = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_identityprovider"
        unique_together = (("type", "external_id"),)

    def get_provider(self) -> Provider:
        from sentry.identity import get

        return get(self.type)


class IdentityManager(BaseManager["Identity"]):
    def get_identities_for_user(
        self, user: User | RpcUser, provider: ExternalProviders
    ) -> QuerySet[Identity]:
        return self.filter(user_id=user.id, idp__type=provider.name)

    def has_identity(self, user: User | RpcUser, provider: ExternalProviders) -> bool:
        return self.get_identities_for_user(user, provider).exists()

    def link_identity(
        self,
        user: User | RpcUser,
        idp: IdentityProvider | RpcIdentityProvider,
        external_id: str,
        should_reattach: bool = True,
        defaults: Mapping[str, Any | None] | None = None,
    ) -> Identity | None:
        """
        Link the user with the identity. If `should_reattach` is passed, handle
        the case where the user is linked to a different identity or the
        identity is linked to a different user.
        """
        from sentry.integrations.slack.analytics import SlackIntegrationIdentityLinked

        defaults = {
            **(defaults or {}),
            "status": IdentityStatus.VALID,
            "date_verified": timezone.now(),
        }
        try:
            identity, created = self.get_or_create(
                idp_id=idp.id, user_id=user.id, external_id=external_id, defaults=defaults
            )
            if not created:
                identity.update(**defaults)
        except IntegrityError:
            if not should_reattach:
                raise
            return self.reattach(idp, external_id, user, defaults)

        analytics.record(
            SlackIntegrationIdentityLinked(
                provider=IntegrationProviderSlug.SLACK.value,
                # Note that prior to circa March 2023 this was user.actor_id. It changed
                # when actor ids were no longer stable between regions for the same user
                actor_id=user.id,
                actor_type="user",
            )
        )
        return identity

    def delete_identity(
        self, user: User | RpcUser, idp: IdentityProvider | RpcIdentityProvider, external_id: str
    ) -> None:
        self.filter(Q(external_id=external_id) | Q(user_id=user.id), idp_id=idp.id).delete()
        logger.info(
            "deleted-identity",
            extra={"external_id": external_id, "idp_id": idp.id, "user_id": user.id},
        )

    def create_identity(
        self,
        idp: IdentityProvider | RpcIdentityProvider,
        external_id: str,
        user: User | RpcUser,
        defaults: Mapping[str, Any],
    ) -> Identity | None:
        identity_model = self.create(
            idp_id=idp.id, user_id=user.id, external_id=external_id, **defaults
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

    def reattach(
        self,
        idp: IdentityProvider | RpcIdentityProvider,
        external_id: str,
        user: User | RpcUser,
        defaults: Mapping[str, Any],
    ) -> Identity | None:
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
        user: User | RpcUser,
        defaults: Mapping[str, Any],
    ) -> Identity | None:
        """
        Updates the identity object for a given user and identity provider
        with the new external id and other fields related to the identity status
        """
        query = self.filter(user_id=user.id, idp=idp)
        query.update(external_id=external_id, **defaults)
        identity_model = query.get()
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


@control_silo_model
class Identity(Model):
    """
    A verified link between a user and a third party identity.
    """

    __relocation_scope__ = RelocationScope.Excluded

    idp = FlexibleForeignKey("sentry.IdentityProvider")
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    external_id = models.TextField()
    data = models.JSONField(default=dict)
    status = BoundedPositiveIntegerField(default=IdentityStatus.UNKNOWN)
    scopes = ArrayField(models.TextField(), default=list)
    date_verified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[IdentityManager] = IdentityManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_identity"
        unique_together = (("idp", "external_id"), ("idp", "user"))

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        with outbox_context(transaction.atomic(router.db_for_write(Identity))):
            # Fan out to all regions to ensure HybridCloudForeignKey cascade works even without org memberships
            region_names = find_all_region_names()
            for region_name in region_names:
                ControlOutbox(
                    shard_scope=OutboxScope.USER_SCOPE,
                    shard_identifier=self.user_id,
                    object_identifier=self.id,
                    category=OutboxCategory.IDENTITY_UPDATE,
                    region_name=region_name,
                ).save()
            return super().delete(*args, **kwargs)

    def get_provider(self) -> Provider:
        from sentry.identity import get

        return get(self.idp.type)
