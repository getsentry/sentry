from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_model, sane_repr
from sentry.db.models.fields.slug import SentrySlugField


@region_silo_model
class ConfigurationModel(Model):
    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("id", "slug", "organization_id")

    slug = SentrySlugField(max_length=32, db_index=True)
    organization_id = BoundedBigIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_configuration"
        unique_together = (("organization_id", "slug"),)
        indexes = [
            models.Index(fields=["organization_id", "slug"]),
        ]


@region_silo_model
class ConfigurationFeatureModel(Model):
    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("configuration_id", "key", "value")

    key = models.CharField(max_length=32)
    value = models.CharField(max_length=1024)
    configuration_id = BoundedBigIntegerField()
    organization_id = BoundedBigIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_configuration_feature"
