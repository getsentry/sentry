from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, Model, sane_repr
from sentry.db.models.base import control_silo_only_model


@control_silo_only_model
class OrganizationMapping(Model):
    """
    This model is used to:
    * Map org slugs to a specific organization and region
    * Safely reserve organization slugs via an eventually consistent cross silo workflow
    """

    __include_in_export__ = True

    organization_id = BoundedBigIntegerField(db_index=True)
    slug = models.SlugField(unique=True)
    # TODO(hybrid-cloud): Name is currently blank for all records. Updating an org name should happen for all applicable slugs.
    name = models.CharField(max_length=64)
    date_created = models.DateTimeField(default=timezone.now)
    customer_id = models.CharField(max_length=255, db_index=True, null=True)
    verified = models.BooleanField(default=False)
    # If a record already exists with the same slug, the organization_id can only be
    # updated IF the idempotency key is identical.
    idempotency_key = models.CharField(max_length=48)
    region_name = models.CharField(max_length=48)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmapping"

    __repr__ = sane_repr("organization_id", "slug", "region_name", "verified")
