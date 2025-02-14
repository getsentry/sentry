from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import BaseConstraint

from sentry.db.models import FlexibleForeignKey, Model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.types.actor import Actor


class OwnerModel(Model):
    """
    A base model that adds ownership fields to existing models.
    """

    owner_user_id = HybridCloudForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete="SET_NULL"
    )
    owner_team = FlexibleForeignKey("sentry.Team", null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        abstract = True

        constraints: list[BaseConstraint] = [
            models.CheckConstraint(
                condition=(
                    models.Q(owner_user_id__isnull=True, owner_team__isnull=False)
                    | models.Q(owner_user_id__isnull=False, owner_team__isnull=True)
                    | models.Q(owner_user_id__isnull=True, owner_team__isnull=True)
                ),
                name="%(app_label)s_%(class)s_owner_constraints",
            ),
        ]

    @property
    def owner(self) -> Actor | None:
        return Actor.from_id(user_id=self.owner_user_id, team_id=self.owner_team_id)
