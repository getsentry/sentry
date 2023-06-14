from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.encoding import force_text

from sentry.conf.server import SENTRY_SCOPES
from sentry.db.models import (
    ArrayField,
    BaseManager,
    FlexibleForeignKey,
    Model,
    control_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.project import Project


def validate_scope_list(value):
    for choice in value:
        if choice not in SENTRY_SCOPES:
            raise ValidationError(f"{choice} is not a valid scope.")


@control_silo_only_model
class OrgAuthToken(Model):
    __include_in_export__ = True

    organization_id = HybridCloudForeignKey("sentry.Organization", null=False, on_delete="CASCADE")
    # The JWT token in hashed form
    token_hashed = models.TextField(unique=True, null=False)
    # An optional representation of the last characters of the original token, to be shown to the user
    token_last_characters = models.CharField(max_length=4, null=True)
    name = models.CharField(max_length=255, null=False)
    scope_list = ArrayField(
        models.TextField(),
        validators=[validate_scope_list],
    )

    created_by = FlexibleForeignKey("sentry.User", null=True, blank=True, on_delete="SET_NULL")
    date_added = models.DateTimeField(default=timezone.now, null=False)
    date_last_used = models.DateTimeField(null=True, blank=True)
    project_last_used_id = HybridCloudForeignKey(
        "sentry.Project", null=True, blank=True, on_delete="SET_NULL"
    )
    date_deactivated = models.DateTimeField(null=True, blank=True)

    objects = BaseManager(cache_fields=("token_hashed",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_orgauthtoken"

    __repr__ = sane_repr("organization_id", "token_hashed")

    def __str__(self):
        return force_text(self.token_hashed)

    def get_audit_log_data(self):
        return {"scopes": self.get_scopes()}

    def get_scopes(self):
        return self.scope_list

    def has_scope(self, scope):
        return scope in self.get_scopes()

    def project_last_used(self) -> Project | None:
        if self.project_last_used_id is None:
            return None

        return Project.objects.get(id=self.project_last_used_id)

    def is_active(self) -> bool:
        return self.date_deactivated is None
