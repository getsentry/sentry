from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry.backup.scopes import RelocationScope
from sentry.db.models import CIEmailField, Model, control_silo_only_model, sane_repr


@control_silo_only_model
class AthenaDemo(Model):
    """
    AthenaDemo represents a fake model that Athena is using for demo purposes only
    """

    __relocation_scope__ = RelocationScope.User

    email = CIEmailField(_("email address"), unique=True, max_length=75)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_athena_demo"

    __repr__ = sane_repr("athena_demo")
