from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.organizationslugreservation import OrganizationSlugReservationType
from sentry.services.hybrid_cloud import REGION_NAME_LENGTH


@region_silo_only_model
class OrganizationSlugReservationReplica(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_slug_reservation_id = HybridCloudForeignKey(
        "sentry.organizationslugreservation",
        on_delete="CASCADE",
        unique=True,
    )
    slug = models.SlugField(unique=True, db_index=True)
    organization_id = BoundedBigIntegerField(db_index=True)
    user_id = BoundedBigIntegerField(db_index=True, null=True)
    region_name = models.CharField(max_length=REGION_NAME_LENGTH, null=False)
    reservation_type = BoundedBigIntegerField(
        choices=OrganizationSlugReservationType.as_choices(),
        null=False,
        default=OrganizationSlugReservationType.PRIMARY.value,
    )
    date_added = models.DateTimeField(null=False, default=timezone.now, editable=False)

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_organizationslugreservationreplica"
        unique_together = (("organization_id", "reservation_type"),)

    __repr__ = sane_repr("organization_id", "slug")
