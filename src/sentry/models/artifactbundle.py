from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)


@region_silo_only_model
class ArtifactBundle(Model):
    __include_in_export__ = False

    bundle_id = models.CharField(max_length=32, null=True)
    organization_id = BoundedBigIntegerField(db_index=True)
    # TODO: define max length.
    release_name = models.CharField(null=True)
    dist_id = BoundedBigIntegerField(null=True)
    file = FlexibleForeignKey("sentry.File")
    artifact_count = BoundedPositiveIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_artifactbundlefile"

        unique_together = (("organization_id", "bundle_id"),)
        index_together = (("organization_id", "release_name"),)


@region_silo_only_model
class DebugIdIndex(Model):
    __include_in_export__ = False

    debug_id = models.CharField(max_length=32, unique=True, db_index=True)
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_debugidindex"


@region_silo_only_model
class ProjectArtifactBundleIndex(Model):
    __include_in_export__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    artifact_bundle_file = FlexibleForeignKey("sentry.ArtifactBundle")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectartifactbundleindex"

        unique_together = (("project_id", "artifact_bundle"),)
