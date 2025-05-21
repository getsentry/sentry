from typing import Any

from sentry import models
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import (
    BoundedBigIntegerField,
    BoundedPositiveBigIntegerField,
    BoundedPositiveIntegerField,
)
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.jsonfield import JSONField


class PreprodArtifact(DefaultFieldsModel):
    """
    A pre-production artifact is an artifact that is built in a pre-production environment such as the user's CI/CD pipeline.
    Examples:
    - iOS app builds
    - Android app builds
    """

    class ArtifactState:
        UPLOADING = 0
        """The user has initiated the upload, but it is not yet complete."""
        UPLOADED = 1
        """The upload is complete, but the artifact is not yet processed."""
        PROCESSING = 2
        """The artifact is being processed."""
        PROCESSED = 3
        """The artifact has been processed and is ready to be used."""
        FAILED = 4
        """The artifact failed to process."""

        @classmethod
        def as_choices(cls):
            return (
                (cls.UPLOADING, "uploading"),
                (cls.UPLOADED, "uploaded"),
                (cls.PROCESSING, "processing"),
                (cls.PROCESSED, "processed"),
                (cls.FAILED, "failed"),
            )

    class ArtifactType:
        XCARCHIVE = 0
        XCFRAMEWORK = 1
        IPA = 2
        AAB = 3
        AAB_ZIPPED = 4
        APK = 5
        APK_ZIPPED = 6

        @classmethod
        def as_choices(cls):
            return (
                (cls.XCARCHIVE, "xcarchive"),
                (cls.XCFRAMEWORK, "xcframework"),
                (cls.IPA, "ipa"),
                (cls.AAB, "aab"),
                (cls.AAB_ZIPPED, "aab_zipped"),
                (cls.APK, "apk"),
                (cls.APK_ZIPPED, "apk_zipped"),
            )

    class ErrorCode:
        UNKNOWN = 0
        """The error code is unknown. Try to use a descriptive error code if possible."""
        UPLOAD_TIMEOUT = 1
        """The upload timed out."""
        ARTIFACT_PROCESSING_TIMEOUT = 2
        """The artifact processing timed out."""
        ARTIFACT_PROCESSING_ERROR = 3
        """The artifact processing failed."""

        @classmethod
        def as_choices(cls):
            return (
                (cls.UNKNOWN, "unknown"),
                (cls.UPLOAD_TIMEOUT, "upload_timeout"),
                (cls.ARTIFACT_PROCESSING_TIMEOUT, "artifact_processing_timeout"),
                (cls.ARTIFACT_PROCESSING_ERROR, "artifact_processing_error"),
            )

    # Having a FK to both Org/Project is unnecessary
    organization_id = BoundedBigIntegerField(db_index=True)
    project = FlexibleForeignKey("sentry.Project")

    # Nullable in case the file upload fails
    file = FlexibleForeignKey("sentry.File", null=True)

    # The date the artifact was built. E.g. an artifact could be built on 05/21/2025,
    # but the user uploaded it on 05/22/2025.
    date_built = models.DateTimeField(null=True)

    build_configuration = models.ForeignKey("sentry.PreprodBuildConfiguration", null=True)

    state = BoundedPositiveIntegerField(
        default=ArtifactState.UPLOADING, choices=ArtifactState.as_choices()
    )

    artifact_type = BoundedPositiveIntegerField(choices=ArtifactType.as_choices(), null=True)

    error_code = BoundedPositiveIntegerField(choices=ErrorCode.as_choices(), null=True)
    error_message = models.TextField(null=True)

    # E.g. 1.2.300
    build_version = models.CharField(max_length=255, null=True)
    # E.g. 9999
    build_number = models.IntegerField(null=True)
    # Some artifacts are embedded with a UUID, e.g. iOS Mach-O binaries
    build_uuid = models.UUIDField(null=True)

    misc = models.Field[dict[str, Any], dict[str, Any]] = JSONField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_preprodartifact"


class PreprodBuildConfiguration(DefaultFieldsModel):
    organization_id = BoundedBigIntegerField(db_index=True)
    project = FlexibleForeignKey("sentry.Project")
    name = models.CharField(max_length=255)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_preprodbuildconfiguration"
        unique_together = ("project", "name")


class PreprodArtifactSizeMetrics(DefaultFieldsModel):
    preprod_artifact = FlexibleForeignKey("sentry.PreprodArtifact")

    # Track which version of size processing determined these values
    processing_version = models.CharField(max_length=255)

    min_install_size = BoundedPositiveBigIntegerField()
    max_install_size = BoundedPositiveBigIntegerField()

    min_download_size = BoundedPositiveBigIntegerField()
    max_download_size = BoundedPositiveBigIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_preprodartifactsizemetrics"
        unique_together = "preprod_artifact"
