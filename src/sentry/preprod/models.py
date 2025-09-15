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
from sentry.models.commitcomparison import CommitComparison


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

    commit_comparison = FlexibleForeignKey(
        "sentry.CommitComparison", null=True, on_delete=models.SET_NULL
    )

    # DEPRECATED, soon to be removed
    commit = FlexibleForeignKey(
        "sentry.Commit", null=True, on_delete=models.SET_NULL, db_constraint=False
    )

    # Installable file like IPA or APK
    installable_app_file_id = BoundedBigIntegerField(db_index=True, null=True)

    # The name of the app, e.g. "My App"
    app_name = models.CharField(max_length=255, null=True)

    # The identifier of the app, e.g. "com.myapp.MyApp"
    app_id = models.CharField(max_length=255, null=True)

    # An identifier for the main binary
    main_binary_identifier = models.CharField(max_length=255, db_index=True, null=True)

    def get_sibling_artifacts_for_commit(self) -> models.QuerySet["PreprodArtifact"]:
        """
        Get all artifacts for the same commit comparison (monorepo scenario).

        Note: Always includes the calling artifact itself along with any siblings.
        Results are filtered by the current artifact's organization for security.

        Returns:
            QuerySet of PreprodArtifact objects, ordered by app_id for stable results
        """
        if not self.commit_comparison:
            return PreprodArtifact.objects.none()

        return PreprodArtifact.objects.filter(
            commit_comparison=self.commit_comparison,
            project__organization_id=self.project.organization_id,
        ).order_by("app_id")

    def get_base_artifact_for_commit(
        self, artifact_type: ArtifactType | None = None
    ) -> models.QuerySet["PreprodArtifact"]:
        """
        Get the base artifact for the same commit comparison (monorepo scenario).
        There can only be one base artifact for a commit comparison, as we only create one
        CommitComparison for a given build and head SHA.
        """
        if not self.commit_comparison:
            return PreprodArtifact.objects.none()

        try:
            base_commit_comparison = CommitComparison.objects.get(
                head_sha=self.commit_comparison.base_sha,
                organization_id=self.project.organization_id,
            )
        except CommitComparison.DoesNotExist:
            return PreprodArtifact.objects.none()

        return PreprodArtifact.objects.filter(
            commit_comparison=base_commit_comparison,
            project__organization_id=self.project.organization_id,
            app_id=self.app_id,
            artifact_type=artifact_type if artifact_type is not None else self.artifact_type,
        )

    def get_head_artifacts_for_commit(
        self, artifact_type: ArtifactType | None = None
    ) -> models.QuerySet["PreprodArtifact"]:
        """
        Get all head artifacts for the same commit comparison (monorepo scenario).
        There can be multiple head artifacts for a commit comparison, as multiple
        CommitComparisons can have the same base SHA.
        """
        if not self.commit_comparison:
            return PreprodArtifact.objects.none()

        head_commit_comparisons = CommitComparison.objects.filter(
            base_sha=self.commit_comparison.head_sha,
            organization_id=self.project.organization_id,
        )

        return PreprodArtifact.objects.filter(
            commit_comparison__in=head_commit_comparisons,
            project__organization_id=self.project.organization_id,
            app_id=self.app_id,
            artifact_type=artifact_type if artifact_type is not None else self.artifact_type,
        )

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

    # Some apps can have multiple ArtifactTypes (e.g. Android dynamic features) so need an identifier to differentiate.
    identifier = models.CharField(max_length=255, null=True)

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
        constraints = [
            # Unique constraint that properly handles NULL values
            models.UniqueConstraint(
                fields=["preprod_artifact", "metrics_artifact_type", "identifier"],
                name="preprod_artifact_size_metrics_unique",
                condition=models.Q(identifier__isnull=False),
            ),
            # Additional unique constraint for records without identifier
            models.UniqueConstraint(
                fields=["preprod_artifact", "metrics_artifact_type"],
                name="preprod_artifact_size_metrics_unique_no_identifier",
                condition=models.Q(identifier__isnull=True),
            ),
        ]


@region_silo_model
class InstallablePreprodArtifact(DefaultFieldsModel):
    """
    A model that represents an installable preprod artifact with an expiring URL.
    This is created when a user generates a download QR code for a preprod artifact.
    """

    __relocation_scope__ = RelocationScope.Excluded

    preprod_artifact = FlexibleForeignKey("preprod.PreprodArtifact")

    # A random string used in the URL path for secure access
    url_path = models.CharField(max_length=255, unique=True, db_index=True)

    # When the install link expires
    expiration_date = models.DateTimeField(null=True)

    # Number of times the IPA was downloaded
    download_count = models.PositiveIntegerField(default=0, null=True)

    class Meta:
        app_label = "preprod"
        db_table = "sentry_installablepreprodartifact"


@region_silo_model
class PreprodArtifactSizeComparison(DefaultFieldsModel):
    """
    Represents a size comparison between two preprod artifact size analyses.
    This is created when a user manually compares builds or when Git based comparisons are run.
    """

    __relocation_scope__ = RelocationScope.Excluded

    head_size_analysis = FlexibleForeignKey(
        "preprod.PreprodArtifactSizeMetrics",
        on_delete=models.CASCADE,
        related_name="size_comparisons_head_size_analysis",
    )
    base_size_analysis = FlexibleForeignKey(
        "preprod.PreprodArtifactSizeMetrics",
        on_delete=models.CASCADE,
        related_name="size_comparisons_base_size_analysis",
    )

    organization_id = BoundedBigIntegerField(db_index=True)

    # File id of the size diff json in filestore
    file_id = BoundedBigIntegerField(db_index=True, null=True)

    class State(IntEnum):
        PENDING = 0
        """The comparison has not started yet."""
        PROCESSING = 1
        """The comparison is in progress."""
        SUCCESS = 2
        """The comparison completed successfully."""
        FAILED = 3
        """The comparison failed. See error_code and error_message for details."""

        @classmethod
        def as_choices(cls):
            return (
                (cls.PENDING, "pending"),
                (cls.PROCESSING, "processing"),
                (cls.SUCCESS, "success"),
                (cls.FAILED, "failed"),
            )

    # The state of the comparison
    state = BoundedPositiveIntegerField(
        default=State.PENDING,
        choices=State.as_choices(),
    )

    class ErrorCode(IntEnum):
        UNKNOWN = 0
        """The error code is unknown. Try to use a descriptive error code if possible."""
        TIMEOUT = 1
        """The size analysis comparison timed out."""

        @classmethod
        def as_choices(cls):
            return (
                (cls.UNKNOWN, "unknown"),
                (cls.TIMEOUT, "timeout"),
            )

    # Set when state is FAILED
    error_code = BoundedPositiveIntegerField(choices=ErrorCode.as_choices(), null=True)
    error_message = models.TextField(null=True)

    class Meta:
        app_label = "preprod"
        db_table = "sentry_preprodartifactsizecomparison"
        unique_together = ("organization_id", "head_size_analysis", "base_size_analysis")
