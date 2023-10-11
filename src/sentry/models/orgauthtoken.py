from __future__ import annotations

from typing import Optional, Tuple

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.encoding import force_str

from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
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
from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.orgauthtoken import orgauthtoken_service

MAX_NAME_LENGTH = 255


def validate_scope_list(value):
    for choice in value:
        if choice not in SENTRY_SCOPES:
            raise ValidationError(f"{choice} is not a valid scope.")


@control_silo_only_model
class OrgAuthToken(Model):
    __relocation_scope__ = RelocationScope.Organization

    organization_id = HybridCloudForeignKey("sentry.Organization", null=False, on_delete="CASCADE")
    # The JWT token in hashed form
    token_hashed = models.TextField(unique=True, null=False)
    # An optional representation of the last characters of the original token, to be shown to the user
    token_last_characters = models.CharField(max_length=4, null=True)
    name = models.CharField(max_length=MAX_NAME_LENGTH, null=False, blank=False)
    scope_list = ArrayField(
        models.TextField(),
        validators=[validate_scope_list],
    )

    created_by = FlexibleForeignKey("sentry.User", null=True, blank=True, on_delete=models.SET_NULL)
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
        return force_str(self.token_hashed)

    def get_audit_log_data(self):
        return {"name": self.name, "scopes": self.get_scopes()}

    def get_allowed_origins(self):
        return ()

    def get_scopes(self):
        return self.scope_list

    def has_scope(self, scope):
        return scope in self.get_scopes()

    def is_active(self) -> bool:
        return self.date_deactivated is None

    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> Optional[Tuple[int, ImportKind]]:
        # TODO(getsentry/team-ospo#190): Prevents a circular import; could probably split up the
        # source module in such a way that this is no longer an issue.
        from sentry.api.utils import generate_region_url
        from sentry.utils.security.orgauthtoken_token import (
            SystemUrlPrefixMissingException,
            generate_token,
            hash_token,
        )

        # If there is a token collision, or the token does not exist for some reason, generate a new
        # one.
        matching_token_hashed = self.__class__.objects.filter(
            token_hashed=self.token_hashed
        ).first()
        if (not self.token_hashed) or matching_token_hashed:
            org_mapping = OrganizationMapping.objects.filter(
                organization_id=self.organization_id
            ).first()
            if org_mapping is None:
                return None
            try:
                token_str = generate_token(org_mapping.slug, generate_region_url())
            except SystemUrlPrefixMissingException:
                return None
            self.token_hashed = hash_token(token_str)
            self.token_last_characters = token_str[-4:]

        return super().write_relocation_import(scope, flags)


def is_org_auth_token_auth(auth: object) -> bool:
    """:returns True when an API token is hitting the API."""
    from sentry.services.hybrid_cloud.auth import AuthenticatedToken

    if isinstance(auth, AuthenticatedToken):
        return auth.kind == "org_auth_token"
    return isinstance(auth, OrgAuthToken)


def get_org_auth_token_id_from_auth(auth: object) -> int | None:
    from sentry.services.hybrid_cloud.auth import AuthenticatedToken

    if isinstance(auth, OrgAuthToken):
        return auth.id
    if isinstance(auth, AuthenticatedToken):
        return auth.entity_id
    return None


def update_org_auth_token_last_used(auth: object, project_ids: list[int]):
    org_auth_token_id = get_org_auth_token_id_from_auth(auth)
    organization_id = getattr(auth, "organization_id", None)
    if org_auth_token_id is not None and organization_id is not None:
        orgauthtoken_service.update_orgauthtoken(
            organization_id=organization_id,
            org_auth_token_id=org_auth_token_id,
            date_last_used=timezone.now(),
            project_last_used_id=project_ids[0] if len(project_ids) > 0 else None,
        )
