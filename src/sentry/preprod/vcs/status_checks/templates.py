from __future__ import annotations

from dataclasses import dataclass

from django.utils.translation import gettext_lazy as _

from sentry.preprod.models import PreprodArtifact


@dataclass(frozen=True)
class _StatusCheckData:
    """Data for formatting status check messages."""

    build_id: int
    app_id: str
    version: str


@dataclass(frozen=True)
class _SuccessStatusCheckData(_StatusCheckData):
    """Extended data for successful status checks with size metrics."""

    download_size: str
    download_change: str
    install_size: str
    install_change: str


@dataclass(frozen=True)
class _FailureStatusCheckData(_StatusCheckData):
    """Extended data for failed status checks with error information."""

    error_message: str


def format_status_check_messages(
    preprod_artifact: PreprodArtifact,
) -> tuple[str, str, str]:
    """
    Format status check messages based on artifact state.

    Returns:
        tuple: (title, subtitle, summary)
    """
    version_parts = []
    if preprod_artifact.build_version:
        version_parts.append(preprod_artifact.build_version)
    if preprod_artifact.build_number:
        version_parts.append(f"({preprod_artifact.build_number})")
    version_string = " ".join(version_parts) if version_parts else "Unknown"

    base_data = _StatusCheckData(
        build_id=preprod_artifact.id,
        app_id=preprod_artifact.app_id or "--",
        version=version_string,
    )

    title = str(_SIZE_ANALYZER_TITLE_BASE)

    match preprod_artifact.state:
        case PreprodArtifact.ArtifactState.UPLOADING | PreprodArtifact.ArtifactState.UPLOADED:
            summary = _SIZE_ANALYZER_PROCESSING_SUMMARY_TEMPLATE % base_data.__dict__
            subtitle = str(_SIZE_ANALYZER_SUBTITLE_PROCESSING)
        case PreprodArtifact.ArtifactState.FAILED:
            failure_data = _FailureStatusCheckData(
                build_id=preprod_artifact.id,
                app_id=preprod_artifact.app_id or "--",
                version=version_string,
                error_message=preprod_artifact.error_message or "Unknown error",
            )
            summary = _SIZE_ANALYZER_FAILURE_SUMMARY_TEMPLATE % failure_data.__dict__
            subtitle = str(_SIZE_ANALYZER_SUBTITLE_ERROR)
        case PreprodArtifact.ArtifactState.PROCESSED:
            from sentry.preprod.models import PreprodArtifactSizeMetrics

            current_metrics = PreprodArtifactSizeMetrics.objects.filter(
                preprod_artifact=preprod_artifact,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            ).first()

            if current_metrics:
                success_data = _SuccessStatusCheckData(
                    build_id=preprod_artifact.id,
                    app_id=preprod_artifact.app_id or "--",
                    version=version_string,
                    download_size=_format_file_size(current_metrics.min_download_size),
                    download_change="N/A",
                    install_size=_format_file_size(current_metrics.min_install_size),
                    install_change="N/A",
                )
                summary = _SIZE_ANALYZER_SUCCESS_SUMMARY_TEMPLATE % success_data.__dict__
            else:
                # TODO(telkins): what to do in this case?
                summary = (
                    _("Build %(build_id)s for `%(app_id)s` processed successfully.")
                    % base_data.__dict__
                )
            subtitle = _generate_success_subtitle(preprod_artifact)
        case _:
            raise ValueError(f"Invalid artifact state: {preprod_artifact.state}")

    # Convert lazy translation strings to regular strings for JSON serialization
    return str(title), str(subtitle), str(summary)


_SIZE_ANALYZER_TITLE_BASE = _("Size Analysis")
_SIZE_ANALYZER_SUBTITLE_PROCESSING = _("Processing...")
_SIZE_ANALYZER_SUBTITLE_SUCCESS = _("Complete")
_SIZE_ANALYZER_SUBTITLE_ERROR = _("Error processing")
_SIZE_ANALYZER_SUBTITLE_COMPLETE_FIRST_BUILD = _("1 build analyzed")
# TODO: Re-add these when size comparison is implemented
# _SIZE_ANALYZER_SUBTITLE_SIZE_INCREASED = _("1 build increased in size")
# _SIZE_ANALYZER_SUBTITLE_SIZE_DECREASED = _("1 build decreased in size")
# _SIZE_ANALYZER_SUBTITLE_NO_CHANGE = _("1 build, no size change")

_SIZE_ANALYZER_PROCESSING_SUMMARY_TEMPLATE = _(
    """| Name | Version | Download | Change | Install | Change | Approval |
|------|---------|----------|--------|---------|--------|----------|
| `%(app_id)s` | %(version)s | Processing... | - | Processing... | - | N/A |

Analysis will be updated when processing completes."""
)
_SIZE_ANALYZER_FAILURE_SUMMARY_TEMPLATE = _(
    """| Name | Version | Error |
|------|---------|-------|
| `%(app_id)s` | %(version)s | %(error_message)s |
"""
)
_SIZE_ANALYZER_SUCCESS_SUMMARY_TEMPLATE = _(
    """| Name | Version | Download | Change | Install | Change | Approval |
|------|---------|----------|--------|---------|--------|----------|
| `%(app_id)s` | %(version)s | %(download_size)s | %(download_change)s | %(install_size)s | %(install_change)s | N/A |
"""
)


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

    current_metrics = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact=preprod_artifact,
        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
    ).first()

    if not current_metrics:
        return str(_SIZE_ANALYZER_SUBTITLE_SUCCESS)

    # For now, just show "1 build analyzed" since we're not doing diffing yet
    return str(_SIZE_ANALYZER_SUBTITLE_COMPLETE_FIRST_BUILD)
