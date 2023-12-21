from __future__ import annotations

import logging
import secrets
import warnings
from string import ascii_letters, digits
from typing import Any, ClassVar, List, Mapping, Optional, Tuple

from django.contrib.auth.models import AbstractBaseUser
from django.contrib.auth.models import UserManager as DjangoUserManager
from django.contrib.auth.signals import user_logged_out
from django.db import IntegrityError, models, router, transaction
from django.db.models import Count, Subquery
from django.db.models.query import QuerySet
from django.dispatch import receiver
from django.forms import model_to_dict
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from bitfield import TypedClassBitField
from sentry.auth.authenticators import available_authenticators
from sentry.backup.dependencies import ImportKind, PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import (
    BaseManager,
    BaseModel,
    BoundedBigAutoField,
    control_silo_only_model,
    sane_repr,
)
from sentry.db.models.utils import unique_db_instance
from sentry.locks import locks
from sentry.models.authenticator import Authenticator
from sentry.models.avatars import UserAvatar
from sentry.models.lostpasswordhash import LostPasswordHash
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.outbox import ControlOutboxBase, OutboxCategory, outbox_context
from sentry.services.hybrid_cloud.organization import RpcRegionUser, organization_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.types.region import find_regions_for_user
from sentry.utils.http import absolute_uri
from sentry.utils.retries import TimedRetryPolicy

audit_logger = logging.getLogger("sentry.audit.user")

MAX_USERNAME_LENGTH = 128
RANDOM_PASSWORD_ALPHABET = ascii_letters + digits
RANDOM_PASSWORD_LENGTH = 32


class UserManager(BaseManager["User"], DjangoUserManager):
    def get_users_with_only_one_integration_for_provider(
        self, provider: ExternalProviders, organization_id: int
    ) -> QuerySet:
        """
        For a given organization, get the list of members that are only
        connected to a single integration.
        """
        from sentry.models.integrations.organization_integration import OrganizationIntegration
        from sentry.models.organizationmembermapping import OrganizationMemberMapping

        org_user_ids = OrganizationMemberMapping.objects.filter(
            organization_id=organization_id
        ).values("user_id")
        org_members_with_provider = (
            OrganizationMemberMapping.objects.values("user_id")
            .annotate(org_counts=Count("organization_id"))
            .filter(
                user_id__in=Subquery(org_user_ids),
                organization_id__in=Subquery(
                    OrganizationIntegration.objects.filter(
                        integration__provider=EXTERNAL_PROVIDERS[provider]
                    ).values("organization_id")
                ),
                org_counts=1,
            )
            .values("user_id")
        )
        return self.filter(id__in=Subquery(org_members_with_provider))


@control_silo_only_model
class User(BaseModel, AbstractBaseUser):
    __relocation_scope__ = RelocationScope.User
    __relocation_custom_ordinal__ = ["username"]

    replication_version: int = 2

    id = BoundedBigAutoField(primary_key=True)
    username = models.CharField(_("username"), max_length=MAX_USERNAME_LENGTH, unique=True)
    # this column is called first_name for legacy reasons, but it is the entire
    # display name
    name = models.CharField(_("name"), max_length=200, blank=True, db_column="first_name")
    email = models.EmailField(_("email address"), blank=True, max_length=75)
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into this admin site."),
    )
    is_active = models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Designates whether this user should be treated as "
            "active. Unselect this instead of deleting accounts."
        ),
    )
    is_unclaimed = models.BooleanField(
        _("unclaimed"),
        default=False,
        help_text=_(
            "Designates that this user was imported via the relocation tool, but has not yet been "
            "claimed by the owner of the associated email. Users in this state have randomized "
            "passwords - when email owners claim the account, they are prompted to reset their "
            "password and do a one-time update to their username."
        ),
    )
    is_superuser = models.BooleanField(
        _("superuser status"),
        default=False,
        help_text=_(
            "Designates that this user has all permissions without explicitly assigning them."
        ),
    )
    is_managed = models.BooleanField(
        _("managed"),
        default=False,
        help_text=_(
            "Designates whether this user should be treated as "
            "managed. Select this to disallow the user from "
            "modifying their account (username, password, etc)."
        ),
    )
    is_sentry_app = models.BooleanField(
        _("is sentry app"),
        null=True,
        default=None,
        help_text=_(
            "Designates whether this user is the entity used for Permissions"
            "on behalf of a Sentry App. Cannot login or use Sentry like a"
            "normal User would."
        ),
    )
    is_password_expired = models.BooleanField(
        _("password expired"),
        default=False,
        help_text=_(
            "If set to true then the user needs to change the " "password on next sign in."
        ),
    )
    last_password_change = models.DateTimeField(
        _("date of last password change"),
        null=True,
        help_text=_("The date the password was changed last."),
    )

    class flags(TypedClassBitField):
        # WARNING: Only add flags to the bottom of this list
        # bitfield flags are dependent on their order and inserting/removing
        # flags from the middle of the list will cause bits to shift corrupting
        # existing data.

        # Do we need to ask this user for newsletter consent?
        newsletter_consent_prompt: bool

        bitfield_default = 0
        bitfield_null = True

    session_nonce = models.CharField(max_length=12, null=True)

    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)
    last_active = models.DateTimeField(_("last active"), default=timezone.now, null=True)

    avatar_type = models.PositiveSmallIntegerField(default=0, choices=UserAvatar.AVATAR_TYPES)
    avatar_url = models.CharField(_("avatar url"), max_length=120, null=True)

    objects: ClassVar[UserManager] = UserManager(cache_fields=["pk"])

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        app_label = "sentry"
        db_table = "auth_user"
        verbose_name = _("user")
        verbose_name_plural = _("users")

    __repr__ = sane_repr("id")

    def class_name(self):
        return "User"

    def delete(self):
        if self.username == "sentry":
            raise Exception('You cannot delete the "sentry" user as it is required by Sentry.')
        with outbox_context(transaction.atomic(using=router.db_for_write(User))):
            avatar = self.avatar.first()
            if avatar:
                avatar.delete()
            for outbox in self.outboxes_for_update():
                outbox.save()
            return super().delete()

    def update(self, *args, **kwds):
        with outbox_context(transaction.atomic(using=router.db_for_write(User))):
            for outbox in self.outboxes_for_update():
                outbox.save()
            return super().update(*args, **kwds)

    def save(self, *args, **kwargs):
        with outbox_context(transaction.atomic(using=router.db_for_write(User))):
            if not self.username:
                self.username = self.email
            result = super().save(*args, **kwargs)
            for outbox in self.outboxes_for_update():
                outbox.save()
            return result

    def has_perm(self, perm_name):
        warnings.warn("User.has_perm is deprecated", DeprecationWarning)
        return self.is_superuser

    def has_module_perms(self, app_label):
        warnings.warn("User.has_module_perms is deprecated", DeprecationWarning)
        return self.is_superuser

    def has_2fa(self):
        return Authenticator.objects.filter(
            user_id=self.id, type__in=[a.type for a in available_authenticators(ignore_backup=True)]
        ).exists()

    def get_unverified_emails(self):
        return self.emails.filter(is_verified=False)

    def get_verified_emails(self):
        return self.emails.filter(is_verified=True)

    def has_verified_emails(self):
        return self.get_verified_emails().exists()

    def has_unverified_emails(self):
        return self.get_unverified_emails().exists()

    def has_usable_password(self):
        if self.password == "" or self.password is None:
            # This is the behavior we've been relying on from Django 1.6 - 2.0.
            # In 2.1, a "" or None password is considered usable.
            # Removing this override requires identifying all the places
            # to put set_unusable_password and a migration.
            return False
        return super().has_usable_password()

    def get_label(self):
        return self.email or self.username or self.id

    def get_display_name(self):
        return self.name or self.email or self.username

    def get_full_name(self):
        return self.name

    def get_salutation_name(self) -> str:
        name = self.name or self.username.split("@", 1)[0].split(".", 1)[0]
        first_name = name.split(" ", 1)[0]
        return first_name.capitalize()

    def get_avatar_type(self):
        return self.get_avatar_type_display()

    def get_actor_identifier(self):
        return f"user:{self.id}"

    def send_confirm_email_singular(self, email, is_new_user=False):
        from sentry import options
        from sentry.utils.email import MessageBuilder

        if not email.hash_is_valid():
            email.set_hash()
            email.save()

        context = {
            "user": self,
            "url": absolute_uri(
                reverse("sentry-account-confirm-email", args=[self.id, email.validation_hash])
            ),
            "confirm_email": email.email,
            "is_new_user": is_new_user,
        }
        msg = MessageBuilder(
            subject="{}Confirm Email".format(options.get("mail.subject-prefix")),
            template="sentry/emails/confirm_email.txt",
            html_template="sentry/emails/confirm_email.html",
            type="user.confirm_email",
            context=context,
        )
        msg.send_async([email.email])

    def send_confirm_emails(self, is_new_user=False):
        email_list = self.get_unverified_emails()
        for email in email_list:
            self.send_confirm_email_singular(email, is_new_user)

    def outboxes_for_update(self) -> List[ControlOutboxBase]:
        return User.outboxes_for_user_update(self.id)

    @staticmethod
    def outboxes_for_user_update(identifier: int) -> List[ControlOutboxBase]:
        return OutboxCategory.USER_UPDATE.as_control_outboxes(
            region_names=find_regions_for_user(identifier),
            object_identifier=identifier,
            shard_identifier=identifier,
        )

    def merge_to(from_user, to_user):
        # TODO: we could discover relations automatically and make this useful
        from sentry.models.auditlogentry import AuditLogEntry
        from sentry.models.authenticator import Authenticator
        from sentry.models.authidentity import AuthIdentity
        from sentry.models.avatars.user_avatar import UserAvatar
        from sentry.models.identity import Identity
        from sentry.models.options.user_option import UserOption
        from sentry.models.organizationmembermapping import OrganizationMemberMapping
        from sentry.models.useremail import UserEmail

        audit_logger.info(
            "user.merge", extra={"from_user_id": from_user.id, "to_user_id": to_user.id}
        )

        organization_ids: List[int]
        organization_ids = OrganizationMemberMapping.objects.filter(
            user_id=from_user.id
        ).values_list("organization_id", flat=True)

        for organization_id in organization_ids:
            organization_service.merge_users(
                organization_id=organization_id, from_user_id=from_user.id, to_user_id=to_user.id
            )

        model_list: tuple[type[BaseModel], ...] = (
            Authenticator,
            Identity,
            UserAvatar,
            UserEmail,
            UserOption,
        )

        for model in model_list:
            for obj in model.objects.filter(user_id=from_user.id):
                try:
                    with transaction.atomic(using=router.db_for_write(User)):
                        obj.update(user_id=to_user.id)
                except IntegrityError:
                    pass

        # users can be either the subject or the object of actions which get logged
        AuditLogEntry.objects.filter(actor=from_user).update(actor=to_user)
        AuditLogEntry.objects.filter(target_user=from_user).update(target_user=to_user)

        with outbox_context(flush=False):
            # remove any SSO identities that exist on from_user that might conflict
            # with to_user's existing identities (only applies if both users have
            # SSO identities in the same org), then pass the rest on to to_user
            # NOTE: This could, become calls to identity_service.delete_ide
            for ai in AuthIdentity.objects.filter(
                user=from_user,
                auth_provider__organization_id__in=AuthIdentity.objects.filter(
                    user_id=to_user.id
                ).values("auth_provider__organization_id"),
            ):
                ai.delete()
            for ai in AuthIdentity.objects.filter(user_id=from_user.id):
                ai.update(user=to_user)

    def set_password(self, raw_password):
        super().set_password(raw_password)
        self.last_password_change = timezone.now()
        self.is_password_expired = False

    def refresh_session_nonce(self, request=None):
        from django.utils.crypto import get_random_string

        self.session_nonce = get_random_string(12)
        if request is not None:
            request.session["_nonce"] = self.session_nonce

    def has_org_requiring_2fa(self) -> bool:
        from sentry.models.organization import OrganizationStatus

        return OrganizationMemberMapping.objects.filter(
            user_id=self.id,
            organization_id__in=Subquery(
                OrganizationMapping.objects.filter(
                    require_2fa=True,
                    status=OrganizationStatus.ACTIVE,
                ).values("organization_id")
            ),
        ).exists()

    def clear_lost_passwords(self):
        LostPasswordHash.objects.filter(user=self).delete()

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> Optional[int]:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # Importing in any scope besides `Global` (which does a naive, blanket restore of all data)
        # and `Config` (which is explicitly meant to import admin accounts) should strip all
        # incoming users of their admin privileges.
        if scope not in {ImportScope.Config, ImportScope.Global}:
            self.is_staff = False
            self.is_superuser = False
            self.is_managed = False

        # No need to mark users newly "unclaimed" when doing a global backup/restore.
        if scope != ImportScope.Global or self.is_unclaimed:
            # New users are marked unclaimed.
            self.is_unclaimed = True

            # Give the user a cryptographically secure random password. The purpose here is to have
            # a password that NO ONE knows - the only way to log into this account is to use the
            # "claim your account" flow to create a new password (or to click "lost password" and
            # end up there anyway), at which point we'll detect the user's `is_unclaimed` status and
            # prompt them to change their `username` as well.
            self.set_password(
                "".join(
                    secrets.choice(RANDOM_PASSWORD_ALPHABET) for _ in range(RANDOM_PASSWORD_LENGTH)
                )
            )

        return old_pk

    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> Optional[Tuple[int, ImportKind]]:
        # Internal function that factors our some common logic.
        def do_write():
            from sentry.api.endpoints.user_details import (
                BaseUserSerializer,
                SuperuserUserSerializer,
                UserSerializer,
            )
            from sentry.services.hybrid_cloud.lost_password_hash.impl import (
                DatabaseLostPasswordHashService,
            )

            serializer_cls = BaseUserSerializer
            if scope not in {ImportScope.Config, ImportScope.Global}:
                serializer_cls = UserSerializer
            else:
                serializer_cls = SuperuserUserSerializer

            serializer_user = serializer_cls(instance=self, data=model_to_dict(self), partial=True)
            serializer_user.is_valid(raise_exception=True)

            self.save(force_insert=True)

            if scope != ImportScope.Global:
                DatabaseLostPasswordHashService().get_or_create(user_id=self.id)

            # TODO(getsentry/team-ospo#191): we need to send an email informing the user of their
            # new account with a resettable password - we'll need to figure out where in the process
            # that actually goes, and how to prevent it from happening during the validation pass.
            return (self.pk, ImportKind.Inserted)

        # If there is no existing user with this `username`, no special renaming or merging
        # shenanigans are needed, as we can just insert this exact model directly.
        existing = User.objects.filter(username=self.username).first()
        if not existing:
            return do_write()

        # Re-use the existing user if merging is enabled.
        if flags.merge_users:
            return (existing.pk, ImportKind.Existing)

        # We already have a user with this `username`, but merging users has not been enabled. In
        # this case, add a random suffix to the importing username.
        lock = locks.get(f"user:username:{self.id}", duration=10, name="username")
        with TimedRetryPolicy(10)(lock.acquire):
            unique_db_instance(
                self,
                self.username,
                max_length=MAX_USERNAME_LENGTH,
                field_name="username",
            )

            # Perform the remainder of the write while we're still holding the lock.
            return do_write()

    @classmethod
    def handle_async_deletion(
        cls,
        identifier: int,
        region_name: str,
        shard_identifier: int,
        payload: Mapping[str, Any] | None,
    ) -> None:
        from sentry.hybridcloud.rpc.services.caching import region_caching_service
        from sentry.services.hybrid_cloud.user.service import get_user

        region_caching_service.clear_key(key=get_user.key_from(identifier), region_name=region_name)

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        from sentry.hybridcloud.rpc.services.caching import region_caching_service
        from sentry.services.hybrid_cloud.user.service import get_user

        region_caching_service.clear_key(key=get_user.key_from(self.id), region_name=region_name)
        organization_service.update_region_user(
            user=RpcRegionUser(
                id=self.id,
                is_active=self.is_active,
                email=self.email,
            ),
            region_name=region_name,
        )


# HACK(dcramer): last_login needs nullable for Django 1.8
User._meta.get_field("last_login").null = True


# When a user logs out, we want to always log them out of all
# sessions and refresh their nonce.
@receiver(user_logged_out, sender=User)
def refresh_user_nonce(sender, request, user, **kwargs):
    if user is None:
        return
    user.refresh_session_nonce()
    user.save(update_fields=["session_nonce"])


@receiver(user_logged_out, sender=RpcUser)
def refresh_api_user_nonce(sender, request, user, **kwargs):
    if user is None:
        return
    user = User.objects.get(id=user.id)
    refresh_user_nonce(sender, request, user, **kwargs)


OutboxCategory.USER_UPDATE.connect_control_model_updates(User)
