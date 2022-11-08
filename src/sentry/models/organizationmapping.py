from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, Model
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
    created = models.DateTimeField(default=timezone.now)
    stripe_id = models.CharField(max_length=255, db_index=True)
    verified = models.BooleanField(default=False)
    # Creating an identical mapping should succeed, even if a record already exists
    # with this slug. We allow this IFF the idempotency key is identical
    idempotency_key = models.CharField(max_length=48)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmapping"
