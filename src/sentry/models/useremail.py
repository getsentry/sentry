from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import TYPE_CHECKING, Iterable, Mapping, Optional, Tuple

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import (
    BaseManager,
    FlexibleForeignKey,
    Model,
    control_silo_only_model,
    sane_repr,
)
from sentry.services.hybrid_cloud.organization.model import RpcOrganization
from sentry.utils.security import get_secure_token

if TYPE_CHECKING:
    from sentry.models import User


class UserEmailManager(BaseManager):
    def get_emails_by_user(self, organization: RpcOrganization) -> Mapping[User, Iterable[str]]:
        from sentry.models.organizationmembermapping import OrganizationMemberMapping

        emails_by_user = defaultdict(set)
        user_emails = self.filter(
            user_id__in=OrganizationMemberMapping.objects.filter(
                organization_id=organization.id
            ).values_list("user_id", flat=True)
        ).select_related("user")
        for entry in user_emails:
            emails_by_user[entry.user].add(entry.email)
        return emails_by_user

    def get_primary_email(self, user: User) -> UserEmail:
        user_email, _ = self.get_or_create(user_id=user.id, email=user.email)
        return user_email


@control_silo_only_model
class UserEmail(Model):
    __relocation_scope__ = RelocationScope.User

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, related_name="emails")
    email = models.EmailField(_("email address"), max_length=75)
    validation_hash = models.CharField(max_length=32, default=get_secure_token)
    date_hash_added = models.DateTimeField(default=timezone.now)
    is_verified = models.BooleanField(
        _("verified"),
        default=False,
        help_text=_("Designates whether this user has confirmed their email."),
    )

    objects = UserEmailManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_useremail"
        unique_together = (("user", "email"),)

    __repr__ = sane_repr("user_id", "email")

    def set_hash(self):
        self.date_hash_added = timezone.now()
        self.validation_hash = get_secure_token()

    def hash_is_valid(self):
        return self.validation_hash and self.date_hash_added > timezone.now() - timedelta(hours=48)

    def is_primary(self):
        return self.user.email == self.email

    @classmethod
    def get_primary_email(cls, user: User) -> UserEmail:
        """@deprecated"""
        return cls.objects.get_primary_email(user)

    def _normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope
    ) -> Optional[int]:
        old_pk = super()._normalize_before_relocation_import(pk_map, scope)
        if old_pk is None:
            return None

        # Only preserve validation hashes in global scope - in all others, have the user verify
        # their email again.
        if scope != ImportScope.Global:
            self.is_verified = False
            self.validation_hash = get_secure_token()
            self.date_hash_added = timezone.now()

        return old_pk

    def write_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope
    ) -> Optional[Tuple[int, int]]:
        old_pk = self._normalize_before_relocation_import(pk_map, scope)
        if old_pk is None:
            return None

        useremail = self.__class__.objects.get(user=self.user, email=self.email)
        for f in self._meta.fields:
            if f.name not in ["id", "pk"]:
                setattr(useremail, f.name, getattr(self, f.name))
        useremail.save()

        return (old_pk, useremail.pk)
