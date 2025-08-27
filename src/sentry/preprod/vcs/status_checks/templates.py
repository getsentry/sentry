from __future__ import annotations

from django.utils.translation import gettext_lazy as _

from sentry.preprod.models import PreprodArtifact


def format_status_check_messages(
    preprod_artifact: PreprodArtifact,
) -> tuple[str, str, str, str | None]:
    """
    Format status check messages based on artifact state.

    Returns:
        tuple: (title, subtitle, summary, target_url)
    """
    # Build version string (used by all states)
    version_parts = []
    if preprod_artifact.build_version:
        version_parts.append(preprod_artifact.build_version)
    if preprod_artifact.build_number:
        version_parts.append(f"({preprod_artifact.build_number})")
    version_string = " ".join(version_parts) if version_parts else "Unknown"

    base_data = {
        "build_id": preprod_artifact.id,
        "app_id": preprod_artifact.app_id,
        "version": version_string,
    }

    if (
        preprod_artifact.state == PreprodArtifact.ArtifactState.UPLOADING
        or preprod_artifact.state == PreprodArtifact.ArtifactState.UPLOADED
    ):
        summary = _SIZE_ANALYZER_PROCESSING_SUMMARY_TEMPLATE % base_data

    elif preprod_artifact.state == PreprodArtifact.ArtifactState.FAILED:
        failure_data = {
            **base_data,
            "error_message": preprod_artifact.error_message or "Unknown error",
        }
        summary = _SIZE_ANALYZER_FAILURE_SUMMARY_TEMPLATE % failure_data

    elif preprod_artifact.state == PreprodArtifact.ArtifactState.PROCESSED:
        # Get current artifact's size metrics
        from sentry.preprod.models import PreprodArtifactSizeMetrics

        current_metrics = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=preprod_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        ).first()

        if current_metrics:
            # Get previous metrics for comparison
            previous_metrics = _get_previous_artifact_metrics(preprod_artifact)

            success_data = {
                **base_data,
                "download_size": _format_file_size(current_metrics.min_download_size),
                "download_change": _format_size_change(
                    current_metrics.min_download_size,
                    previous_metrics.min_download_size if previous_metrics else None,
                ),
                "install_size": _format_file_size(current_metrics.min_install_size),
                "install_change": _format_size_change(
                    current_metrics.min_install_size,
                    previous_metrics.min_install_size if previous_metrics else None,
                ),
                "details_url": f"https://sentry.io/preprod/builds/{preprod_artifact.id}/",
            }
            summary = _SIZE_ANALYZER_SUCCESS_SUMMARY_TEMPLATE % success_data
        else:
            # TODO(telkins): what to do in this case?
            summary = _("Build %(build_id)s for `%(app_id)s` processed successfully.") % base_data

    else:
        raise ValueError(f"Invalid artifact state: {preprod_artifact.state}")

    # Use different titles for different states
    if preprod_artifact.state == PreprodArtifact.ArtifactState.FAILED:
        title = str(_SIZE_ANALYZER_TITLE_BASE)
        subtitle = str(_SIZE_ANALYZER_SUBTITLE_ERROR)
    elif (
        preprod_artifact.state == PreprodArtifact.ArtifactState.UPLOADING
        or preprod_artifact.state == PreprodArtifact.ArtifactState.UPLOADED
    ):
        title = str(_SIZE_ANALYZER_TITLE_BASE)
        subtitle = str(_SIZE_ANALYZER_SUBTITLE_PROCESSING)
    else:  # PROCESSED
        title = str(_SIZE_ANALYZER_TITLE_BASE)
        # Generate dynamic subtitle based on size changes
        subtitle = _generate_success_subtitle(preprod_artifact)

    # Convert lazy translation strings to regular strings for JSON serialization
    # TODO(telkins): add rich text from our data
    return str(title), str(subtitle), str(summary), None


_SIZE_ANALYZER_TITLE_BASE = _("Size Analysis")
_SIZE_ANALYZER_SUBTITLE_PROCESSING = _("Processing...")
_SIZE_ANALYZER_SUBTITLE_SUCCESS = _("Complete")
_SIZE_ANALYZER_SUBTITLE_ERROR = _("Error processing")
_SIZE_ANALYZER_SUBTITLE_COMPLETE_FIRST_BUILD = _("1 build analyzed")
_SIZE_ANALYZER_SUBTITLE_SIZE_INCREASED = _("1 build increased in size")
_SIZE_ANALYZER_SUBTITLE_SIZE_DECREASED = _("1 build decreased in size")
_SIZE_ANALYZER_SUBTITLE_NO_CHANGE = _("1 build, no size change")

_SIZE_ANALYZER_PROCESSING_SUMMARY_TEMPLATE = _(
    """| Name | Version | Download | Change | Install | Change | Approval |
|------|---------|----------|--------|---------|--------|----------|
| %(app_id)s | %(version)s | Processing... | - | Processing... | - | N/A |

Analysis will be updated when processing completes."""
)
_SIZE_ANALYZER_FAILURE_SUMMARY_TEMPLATE = _(
    """| Name | Version | Error |
|------|---------|-------|
| %(app_id)s | %(version)s | %(error_message)s |
"""
)
_SIZE_ANALYZER_SUCCESS_SUMMARY_TEMPLATE = _(
    """| Name | Version | Download | Change | Install | Change | Approval |
|------|---------|----------|--------|---------|--------|----------|
| %(app_id)s | %(version)s | %(download_size)s | %(download_change)s | %(install_size)s | %(install_change)s | N/A |
"""
)


def _format_size_change(current_size: int | None, previous_size: int | None) -> str:
    """Format size change with appropriate icon and percentage."""
    if current_size is None or previous_size is None:
        return "N/A"

    diff = current_size - previous_size
    if diff == 0:
        return "No change"

    # Format the absolute difference
    if abs(diff) >= 1024 * 1024:  # MB
        size_str = f"{abs(diff) / (1024 * 1024):.1f} MB"
    elif abs(diff) >= 1024:  # KB
        size_str = f"{abs(diff) / 1024:.1f} KB"
    else:  # B
        size_str = f"{abs(diff)} B"

    # Calculate percentage
    percentage = (diff / previous_size) * 100

    # Add appropriate icon and format
    if diff > 0:
        return f"🔺 {size_str} ({percentage:.2f}%)"
    else:
        return f"🔽 {size_str} ({percentage:.2f}%)"


def _format_file_size(size_bytes: int | None) -> str:
    """Format file size in human readable format."""
    if size_bytes is None:
        return "Unknown"

    if size_bytes >= 1024 * 1024:  # MB
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    elif size_bytes >= 1024:  # KB
        return f"{size_bytes / 1024:.1f} KB"
    else:  # B
        return f"{size_bytes} B"


def _generate_success_subtitle(preprod_artifact: PreprodArtifact) -> str:
    """Generate a dynamic subtitle based on size changes for successful builds."""
    from sentry.preprod.models import PreprodArtifactSizeMetrics

    # Get current metrics
    current_metrics = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact=preprod_artifact,
        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
    ).first()

    if not current_metrics:
        return str(_SIZE_ANALYZER_SUBTITLE_SUCCESS)

    # Get previous metrics for comparison
    previous_metrics = _get_previous_artifact_metrics(preprod_artifact)

    if not previous_metrics:
        # No previous build to compare to
        return str(_SIZE_ANALYZER_SUBTITLE_COMPLETE_FIRST_BUILD)

    # Check if sizes increased, decreased, or stayed the same
    download_change = current_metrics.min_download_size - previous_metrics.min_download_size
    install_change = current_metrics.min_install_size - previous_metrics.min_install_size

    # For now, just consider one build (this artifact)
    # In the future, this can be expanded to handle multiple builds
    if download_change > 0 or install_change > 0:
        return str(_SIZE_ANALYZER_SUBTITLE_SIZE_INCREASED)
    elif download_change < 0 or install_change < 0:
        return str(_SIZE_ANALYZER_SUBTITLE_SIZE_DECREASED)
    else:
        return str(_SIZE_ANALYZER_SUBTITLE_NO_CHANGE)


def _get_previous_artifact_metrics(preprod_artifact: PreprodArtifact):
    """Get the previous artifact's size metrics for comparison."""
    from sentry.preprod.models import PreprodArtifactSizeMetrics

    # Find previous artifact in the same project with the same app_id
    previous_artifact = (
        PreprodArtifact.objects.filter(
            project=preprod_artifact.project,
            app_id=preprod_artifact.app_id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            id__lt=preprod_artifact.id,  # Earlier artifact
        )
        .order_by("-id")
        .first()
    )

    if not previous_artifact:
        return None

    # Get main artifact metrics from the previous artifact
    return PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact=previous_artifact,
        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
    ).first()
