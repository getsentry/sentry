from django.db import models
from django.db.models import Q
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.apiscopes import HasApiScopes


@control_silo_model
class ApiAuthorization(Model, HasApiScopes):
    """
    Tracks which scopes a user has authorized for a given application.

    This is used to determine when we need re-prompt a user, as well as track
    overall approved applications (vs individual tokens).
    """

    __relocation_scope__ = {RelocationScope.Global, RelocationScope.Config}

    # users can generate tokens without being application-bound
    application = FlexibleForeignKey("sentry.ApiApplication", null=True)
    user = FlexibleForeignKey("sentry.User")
    date_added = models.DateTimeField(default=timezone.now)

    # APIAuthorization is usually per user but in cases of some application permissions
    # we want to limit it to one organization of that user. If null the authorization is user level
    organization_id = HybridCloudForeignKey(
        "sentry.Organization",
        db_index=True,
        null=True,
        on_delete="CASCADE",
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apiauthorization"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "application"],
                name="apiauthorization_user_app",
                condition=Q(organization_id__isnull=True),
            ),
            models.UniqueConstraint(
                fields=["user", "application", "organization_id"],
                name="apiauthorization_user_app_org",
                condition=Q(organization_id__isnull=False),
            ),
        ]

    __repr__ = sane_repr("user_id", "application_id")

    def get_relocation_scope(self) -> RelocationScope:
        if self.application_id is not None:
            # TODO(getsentry/team-ospo#188): this should be extension scope once that gets added.
            return RelocationScope.Global

        return RelocationScope.Config
