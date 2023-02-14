from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)
from sentry.models import DB_VERSION_LENGTH


@region_silo_only_model
class ArtifactBundle(Model):
    __include_in_export__ = False

    bundle_id = models.UUIDField(null=True)
    organization_id = BoundedBigIntegerField(db_index=True)
    release_name = models.CharField(max_length=DB_VERSION_LENGTH, null=True)
    dist_id = BoundedBigIntegerField(null=True)
    file = FlexibleForeignKey("sentry.File")
    artifact_count = BoundedPositiveIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_artifactbundlefile"

        unique_together = (
            ("organization_id", "bundle_id"),
            ("organization_id", "release_name"),
        )
        index_together = (("organization_id", "release_name"),)


@region_silo_only_model
class DebugIdArtifactBundle(Model):
    __include_in_export__ = False

    debug_id = models.UUIDField(unique=True, db_index=True)
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_debugidartifactbundle"


@region_silo_only_model
class ProjectArtifactBundle(Model):
    __include_in_export__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectartifactbundle"

        unique_together = (("project_id", "artifact_bundle"),)
