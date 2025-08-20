from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, control_silo_model, sane_repr
from sentry.hybridcloud.models.outbox import ControlOutboxBase
from sentry.hybridcloud.outbox.base import ControlOutboxProducingModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.types.region import find_regions_for_user
from sentry.utils.security import get_secure_token
from sentry.utils.sms import InvalidPhoneNumber, phone_number_as_e164


@control_silo_model
class UserPhone(ControlOutboxProducingModel):
    __relocation_scope__ = RelocationScope.User

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, related_name="phones")
    phone = models.CharField(
        _("phone number"),
        max_length=20,
        help_text=_("Phone number in E.164 format (e.g., +1234567890)"),
    )
    validation_hash = models.CharField(max_length=32, default=get_secure_token)
    date_hash_added = models.DateTimeField(default=timezone.now)
    is_verified = models.BooleanField(
        _("verified"),
        default=False,
        help_text=_("Designates whether this user has confirmed their phone number."),
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userphone"
        unique_together = (("user", "phone"),)

    __repr__ = sane_repr("user_id", "phone")

    # TODO: Add relocation import if necessary? Look to UserEmail for reference
    def save(self, *args, **kwargs):
        """Ensure phone number is in E.164 format before saving."""
        try:
            self.phone = phone_number_as_e164(self.phone)
        except InvalidPhoneNumber:
            from django.core.exceptions import ValidationError

            raise ValidationError(_("Please enter a valid phone number."))
        super().save(*args, **kwargs)

    def outboxes_for_update(self, shard_identifier: int | None = None) -> list[ControlOutboxBase]:
        regions = find_regions_for_user(self.user_id)
        return [
            outbox
            for outbox in OutboxCategory.USER_UPDATE.as_control_outboxes(
                region_names=regions,
                shard_identifier=self.user_id,
                object_identifier=self.user_id,
            )
        ]

    def set_hash(self) -> None:
        self.date_hash_added = timezone.now()
        self.validation_hash = get_secure_token()

    def hash_is_valid(self) -> bool:
        return bool(
            self.validation_hash and self.date_hash_added > timezone.now() - timedelta(hours=48)
        )
