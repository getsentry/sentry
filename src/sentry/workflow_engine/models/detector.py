from django.conf import settings
from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.types.actor import Actor


@region_silo_model
class Detector(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.CharField(max_length=200)

    owner_user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    owner_team = FlexibleForeignKey("sentry.Team", null=True, on_delete=models.SET_NULL)

    @property
    def owner(self) -> Actor | None:
        return Actor.from_id(user_id=self.owner_user_id, team_id=self.owner_team_id)
