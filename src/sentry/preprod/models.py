from __future__ import annotations

import logging
from collections import defaultdict
from enum import IntEnum
from typing import ClassVar, Self

import sentry_sdk
from django.db import models
from django.db.models import IntegerField, OuterRef, Subquery, Sum
from django.db.models.functions import Coalesce

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.bounded import (
    BoundedBigIntegerField,
    BoundedPositiveBigIntegerField,
    BoundedPositiveIntegerField,
)
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models.commitcomparison import CommitComparison

logger = logging.getLogger(__name__)


class PreprodArtifactQuerySet(BaseQuerySet["PreprodArtifact"]):
    def annotate_download_count(self) -> Self:
        return self.annotate(
            download_count=Coalesce(
                Sum("installablepreprodartifact__download_count"),
                0,
                output_field=IntegerField(),
            )
        )

    def annotate_main_size_metrics(self) -> Self:
        # Import here to avoid circular import since PreprodArtifactSizeMetrics
        # is defined later in this file
        from sentry.preprod.models import PreprodArtifactSizeMetrics

        main_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=OuterRef("pk"),
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        return self.annotate(
            install_size=Subquery(main_metrics.values("max_install_size")[:1]),
            download_size=Subquery(main_metrics.values("max_download_size")[:1]),
        )


class PreprodArtifactModelManager(BaseManager["PreprodArtifact"]):
    def get_queryset(self) -> PreprodArtifactQuerySet:
        return PreprodArtifactQuerySet(self.model, using=self._db)


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
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
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
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
            return (
                (cls.XCARCHIVE, "xcarchive"),
                (cls.AAB, "aab"),
                (cls.APK, "apk"),
            )

        def to_str(self) -> str:
            return self.name.lower()

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
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
            return (
                (cls.UNKNOWN, "unknown"),
                (cls.UPLOAD_TIMEOUT, "upload_timeout"),
                (cls.ARTIFACT_PROCESSING_TIMEOUT, "artifact_processing_timeout"),
                (cls.ARTIFACT_PROCESSING_ERROR, "artifact_processing_error"),
            )

    __relocation_scope__ = RelocationScope.Excluded
    objects: ClassVar[PreprodArtifactModelManager] = PreprodArtifactModelManager()

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
    # DEPRECATED, use PreprodArtifactMobileAppInfo instead
    build_version = models.CharField(max_length=255, null=True)
    # E.g. 9999
    # DEPRECATED, use PreprodArtifactMobileAppInfo instead
    build_number = BoundedBigIntegerField(null=True)

    # Version of tooling used to upload/build the artifact, extracted from metadata files
    cli_version = models.CharField(max_length=255, null=True)
    fastlane_plugin_version = models.CharField(max_length=255, null=True)
    gradle_plugin_version = models.CharField(max_length=255, null=True)

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
    # DEPRECATED, use PreprodArtifactMobileAppInfo instead
    app_name = models.CharField(max_length=255, null=True)

    # The identifier of the app, e.g. "com.myapp.MyApp"
    app_id = models.CharField(max_length=255, null=True)

    # An identifier for the main binary
    main_binary_identifier = models.CharField(max_length=255, db_index=True, null=True)

    # The objectstore id of the app icon
    # DEPRECATED, use PreprodArtifactMobileAppInfo instead
    app_icon_id = models.CharField(max_length=255, null=True)

    def get_sibling_artifacts_for_commit(self) -> list[PreprodArtifact]:
        """
        Get sibling artifacts for the same commit, deduplicated by (app_id, artifact_type).

        When multiple artifacts exist for the same (app_id, artifact_type) combination
        (e.g., due to reprocessing or CI retries), this method returns only one artifact
        per combination to prevent duplicate rows in status checks:
        - For the calling artifact's (app_id, artifact_type): Returns the calling artifact itself
        - For other combinations: Returns the earliest (oldest) artifact for that combination

        Note: Deduplication by both app_id and artifact_type is necessary because
        iOS and Android apps can share the same app_id (e.g., "com.example.app").

        Results are filtered by the current artifact's organization for security.

        Returns:
            List of PreprodArtifact objects, deduplicated by (app_id, artifact_type),
            ordered by app_id
        """
        if not self.commit_comparison:
            return []

        all_artifacts = PreprodArtifact.objects.filter(
            commit_comparison=self.commit_comparison,
            project__organization_id=self.project.organization_id,
        ).order_by("app_id", "artifact_type", "date_added")

        artifacts_by_key = defaultdict(list)
        for artifact in all_artifacts:
            key = (artifact.app_id, artifact.artifact_type)
            artifacts_by_key[key].append(artifact)

        selected_artifacts = []
        for (app_id, artifact_type), artifacts in artifacts_by_key.items():
            if self.app_id == app_id and self.artifact_type == artifact_type:
                selected_artifacts.append(self)
            else:
                selected_artifacts.append(artifacts[0])

        selected_artifacts.sort(key=lambda a: a.app_id or "")
        return selected_artifacts

    def get_base_artifact_for_commit(
        self, artifact_type: ArtifactType | None = None
    ) -> models.QuerySet[PreprodArtifact]:
        """
        Get the base artifact for the same commit comparison (monorepo scenario).
        Multiple artifacts can share the same commit comparison, but only one should
        match the same (app_id, artifact_type, build_configuration) combination.
        """
        if not self.commit_comparison:
            return PreprodArtifact.objects.none()

        base_commit_comparisons_qs = CommitComparison.objects.filter(
            head_sha=self.commit_comparison.base_sha,
            organization_id=self.project.organization_id,
        ).order_by("date_added")
        base_commit_comparisons = list(base_commit_comparisons_qs)

        if len(base_commit_comparisons) == 0:
            return PreprodArtifact.objects.none()
        elif len(base_commit_comparisons) == 1:
            base_commit_comparison = base_commit_comparisons[0]
        else:
            logger.warning(
                "preprod.models.get_base_artifact_for_commit.multiple_base_commit_comparisons",
                extra={
                    "head_sha": self.commit_comparison.head_sha,
                    "organization_id": self.project.organization_id,
                    "base_commit_comparison_ids": [c.id for c in base_commit_comparisons],
                },
            )
            sentry_sdk.capture_message(
                "Multiple base commitcomparisons found",
                level="error",
                extras={
                    "sha": self.commit_comparison.head_sha,
                },
            )
            # Take first (oldest) commit comparison
            base_commit_comparison = base_commit_comparisons[0]

        return PreprodArtifact.objects.filter(
            commit_comparison=base_commit_comparison,
            project__organization_id=self.project.organization_id,
            app_id=self.app_id,
            artifact_type=artifact_type if artifact_type is not None else self.artifact_type,
            build_configuration=self.build_configuration,
        )

    def get_head_artifacts_for_commit(
        self, artifact_type: ArtifactType | None = None
    ) -> models.QuerySet[PreprodArtifact]:
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

    def get_size_metrics(
        self,
        metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType | None = None,
        identifier: str | None = None,
    ) -> models.QuerySet[PreprodArtifactSizeMetrics]:
        """Get size metrics for this artifact with optional filtering."""
        queryset = self.preprodartifactsizemetrics_set.all()

        if metrics_artifact_type is not None:
            queryset = queryset.filter(metrics_artifact_type=metrics_artifact_type)

        if identifier is not None:
            queryset = queryset.filter(identifier=identifier)

        return queryset

    @classmethod
    def get_size_metrics_for_artifacts(
        cls,
        artifacts: models.QuerySet[PreprodArtifact] | list[PreprodArtifact],
        metrics_artifact_type: PreprodArtifactSizeMetrics.MetricsArtifactType | None = None,
        identifier: str | None = None,
    ) -> dict[int, models.QuerySet[PreprodArtifactSizeMetrics]]:
        """
        Get size metrics for multiple artifacts using a single query.

        Returns:
            Dict mapping artifact_id -> QuerySet of size metrics
        """
        from sentry.preprod.models import PreprodArtifactSizeMetrics

        if isinstance(artifacts, list):
            artifact_ids = [a.id for a in artifacts]
        else:
            artifact_ids = list(artifacts.values_list("id", flat=True))

        if not artifact_ids:
            return {}

        queryset = PreprodArtifactSizeMetrics.objects.filter(preprod_artifact_id__in=artifact_ids)

        if metrics_artifact_type is not None:
            queryset = queryset.filter(metrics_artifact_type=metrics_artifact_type)

        if identifier is not None:
            queryset = queryset.filter(identifier=identifier)

        # Group results by artifact_id
        results: dict[int, models.QuerySet[PreprodArtifactSizeMetrics]] = {}
        for artifact_id in artifact_ids:
            results[artifact_id] = queryset.filter(preprod_artifact_id=artifact_id)

        return results

    def is_android(self) -> bool:
        return (
            self.artifact_type == self.ArtifactType.AAB
            or self.artifact_type == self.ArtifactType.APK
        )

    def is_ios(self) -> bool:
        return self.artifact_type == self.ArtifactType.XCARCHIVE

    def get_platform_label(self) -> str | None:
        if self.is_android():
            return "Android"
        elif self.is_ios():
            return "iOS"
        return None

    class Meta:
        app_label = "preprod"
        db_table = "sentry_preprodartifact"
        indexes = [
            models.Index(fields=["project", "date_added"]),
        ]


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
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
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
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
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
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
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
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
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
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
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


@region_silo_model
class PreprodArtifactMobileAppInfo(DefaultFieldsModel):
    """
    Information about a mobile app, e.g. iOS or Android.
    """

    __relocation_scope__ = RelocationScope.Excluded

    preprod_artifact = models.OneToOneField(
        "preprod.PreprodArtifact", related_name="mobile_app_info", on_delete=models.CASCADE
    )

    # E.g. 1.2.300
    build_version = models.CharField(max_length=255, null=True)
    # E.g. 9999
    build_number = BoundedBigIntegerField(null=True)
    # The objectstore id of the app icon
    app_icon_id = models.CharField(max_length=255, null=True)
    # The name of the app, e.g. "My App"
    app_name = models.CharField(max_length=255, null=True)
    # Miscellaneous fields that we don't need columns for
    extras = models.JSONField(null=True)

    class Meta:
        app_label = "preprod"
        db_table = "sentry_preprodartifactmobileappinfo"
