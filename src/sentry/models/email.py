from __future__ import annotations

from typing import Optional, Tuple

from django.db import models
from django.forms import model_to_dict
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import CIEmailField, Model, control_silo_only_model, sane_repr


@control_silo_only_model
class Email(Model):
    """
    Email represents a unique email. Email settings (unsubscribe state) should be associated here.
    UserEmail represents whether a given user account has access to that email.
    """

    __relocation_scope__ = RelocationScope.User

    email = CIEmailField(_("email address"), unique=True, max_length=75)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_email"

    __repr__ = sane_repr("email")

    def write_relocation_import(
        self, _s: ImportScope, _f: ImportFlags
    ) -> Optional[Tuple[int, ImportKind]]:
        # Ensure that we never attempt to duplicate email entries, as they must always be unique.
        (email, created) = self.__class__.objects.get_or_create(
            email=self.email, defaults=model_to_dict(self)
        )
        if email:
            self.pk = email.pk
            self.save()

        return (self.pk, ImportKind.Inserted if created else ImportKind.Existing)
