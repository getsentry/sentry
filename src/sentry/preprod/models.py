from enum import IntEnum

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.bounded import (
    BoundedBigIntegerField,
    BoundedPositiveBigIntegerField,
    BoundedPositiveIntegerField,
)
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class PreprodArtifact(DefaultFieldsModel):
    """
    A pre-production artifact provided by the user, presumably from their CI/CD pipeline or a manual build.
    With this, we can analyze their artifact and provide them with insights to fix _before_
    it's released to production.

    Examples:
    - iOS app builds
    - Android app builds
    """

    class ArtifactState(IntEnum):
        UPLOADING = 0
        """The user has initiated the upload, but it is not yet complete."""
        UPLOADED = 1
        """The upload is complete, but the artifact is not yet processed."""
        PROCESSED = 3
        """The artifact has been processed and is ready to be used."""
        FAILED = 4
        """The artifact failed to upload or process. Read the error_code and error_message for more details."""

        @classmethod
        def as_choices(cls):
            return (
                (cls.UPLOADING, "uploading"),
                (cls.UPLOADED, "uploaded"),
                (cls.PROCESSED, "processed"),
                (cls.FAILED, "failed"),
            )

    class ArtifactType(IntEnum):
        XCARCHIVE = 0
        """Apple Xcode archive."""
        AAB = 1
        """Android App Bundle."""
        APK = 2
        """Android APK."""

        @classmethod
        def as_choices(cls):
            return (
                (cls.XCARCHIVE, "xcarchive"),
                (cls.AAB, "aab"),
                (cls.APK, "apk"),
            )

    class ErrorCode(IntEnum):
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

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")

    # Nullable in case the file upload fails
    file_id = BoundedBigIntegerField(db_index=True, null=True)

    # The date the artifact was built. E.g. an artifact could be built on 05/21/2025,
    # but the user uploaded it on 05/22/2025.
    date_built = models.DateTimeField(null=True)

    build_configuration = FlexibleForeignKey(
        "preprod.PreprodBuildConfiguration", null=True, on_delete=models.SET_NULL
    )

    state = BoundedPositiveIntegerField(
        default=ArtifactState.UPLOADING, choices=ArtifactState.as_choices()
    )

    # Nullable because we only know the type after the artifact has been processed
    artifact_type = BoundedPositiveIntegerField(choices=ArtifactType.as_choices(), null=True)

    error_code = BoundedPositiveIntegerField(choices=ErrorCode.as_choices(), null=True)
    error_message = models.TextField(null=True)

    # E.g. 1.2.300
    build_version = models.CharField(max_length=255, null=True)
    # E.g. 9999
    build_number = BoundedBigIntegerField(null=True)

    # Miscellaneous fields that we don't need columns for, e.g. enqueue/dequeue times, user-agent, etc.
    extras = models.JSONField(null=True)

    commit = FlexibleForeignKey("sentry.Commit", null=True, on_delete=models.SET_NULL)

    # Installable file like IPA or APK
    installable_app_file_id = BoundedBigIntegerField(db_index=True, null=True)

    class Meta:
        app_label = "preprod"
        db_table = "sentry_preprodartifact"


@region_silo_model
class PreprodBuildConfiguration(DefaultFieldsModel):
    """The build configuration used to build the artifact, e.g. "Debug" or "Release"."""

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    name = models.CharField(max_length=255)

    class Meta:
        app_label = "preprod"
        db_table = "sentry_preprodbuildconfiguration"
        unique_together = ("project", "name")


@region_silo_model
class PreprodArtifactSizeMetrics(DefaultFieldsModel):
    """
    Metrics about the size analysis of a pre-production artifact. Each PreprodArtifact can have 0 or many
    size metrics.
    """

    class MetricsArtifactType(IntEnum):
        MAIN_ARTIFACT = 0
        """The main artifact."""
        WATCH_ARTIFACT = 1
        """An embedded watch artifact."""
        ANDROID_DYNAMIC_FEATURE = 2
        """An embedded Android dynamic feature artifact."""

        @classmethod
        def as_choices(cls):
            return (
                (cls.MAIN_ARTIFACT, "main_artifact"),
                (cls.WATCH_ARTIFACT, "watch_artifact"),
                (cls.ANDROID_DYNAMIC_FEATURE, "android_dynamic_feature_artifact"),
            )

    class SizeAnalysisState(IntEnum):
        PENDING = 0
        """Size analysis has not started yet."""
        PROCESSING = 1
        """Size analysis is in progress."""
        COMPLETED = 2
        """Size analysis completed successfully."""
        FAILED = 3
        """Size analysis failed. See error_code and error_message for details."""

        @classmethod
        def as_choices(cls):
            return (
                (cls.PENDING, "pending"),
                (cls.PROCESSING, "processing"),
                (cls.COMPLETED, "completed"),
                (cls.FAILED, "failed"),
            )

    class ErrorCode(IntEnum):
        UNKNOWN = 0
        """The error code is unknown. Try to use a descriptive error code if possible."""
        TIMEOUT = 1
        """The size analysis processing timed out."""
        UNSUPPORTED_ARTIFACT = 2
        """The artifact type is not supported for size analysis."""
        PROCESSING_ERROR = 3
        """An error occurred during size analysis processing."""

        @classmethod
        def as_choices(cls):
            return (
                (cls.UNKNOWN, "unknown"),
                (cls.TIMEOUT, "timeout"),
                (cls.UNSUPPORTED_ARTIFACT, "unsupported_artifact"),
                (cls.PROCESSING_ERROR, "processing_error"),
            )

    __relocation_scope__ = RelocationScope.Excluded

    preprod_artifact = FlexibleForeignKey("preprod.PreprodArtifact")
    metrics_artifact_type = BoundedPositiveIntegerField(
        choices=MetricsArtifactType.as_choices(), null=True
    )

    # Size analysis processing state
    state = BoundedPositiveIntegerField(
        default=SizeAnalysisState.PENDING, choices=SizeAnalysisState.as_choices()
    )
    error_code = BoundedPositiveIntegerField(choices=ErrorCode.as_choices(), null=True)
    error_message = models.TextField(null=True)

    # Track which version of size processing determined these values
    processing_version = models.CharField(max_length=255, null=True)

    # Size fields are nullable since they won't be available until processing completes
    min_install_size = BoundedPositiveBigIntegerField(null=True)
    max_install_size = BoundedPositiveBigIntegerField(null=True)
    min_download_size = BoundedPositiveBigIntegerField(null=True)
    max_download_size = BoundedPositiveBigIntegerField(null=True)

    # Size analysis wont necessarily be run on every artifact (based on quotas)
    analysis_file_id = BoundedBigIntegerField(db_index=True, null=True)

    class Meta:
        app_label = "preprod"
        db_table = "sentry_preprodartifactsizemetrics"
        unique_together = ("preprod_artifact", "metrics_artifact_type")
