from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_only_model, sane_repr
from sentry.services.hybrid_cloud import REGION_NAME_LENGTH


@region_silo_only_model
class OrganizationSlugReservationReplica(Model):
    __relocation_scope__ = RelocationScope.Excluded

    slug = models.SlugField(unique=True, db_index=True)
    organization_id = BoundedBigIntegerField(db_index=True)
    region_name = models.CharField(max_length=REGION_NAME_LENGTH)
    user_id = BoundedBigIntegerField(db_index=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationslugreservationreplica"

    __repr__ = sane_repr("organization_id", "slug")

    def __str__(self):
        return self.slug
