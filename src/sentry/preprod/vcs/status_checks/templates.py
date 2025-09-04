from __future__ import annotations

from enum import Enum

from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics


class _OverallStatus(Enum):
    PROCESSING = "processing"
    FAILED = "failed"
    SUCCESS = "success"


_SIZE_ANALYZER_TITLE_BASE = _("Size Analysis")


def format_status_check_messages(
    artifacts: list[PreprodArtifact],
    size_metrics_map: dict[int, PreprodArtifactSizeMetrics],
) -> tuple[str, str, str]:
    """
    Args:
        artifacts: List of PreprodArtifact objects
        size_metrics_map: Dict mapping artifact_id to PreprodArtifactSizeMetrics

    Returns:
        tuple: (title, subtitle, summary)
    """
    if not artifacts:
        raise ValueError("Cannot format messages for empty artifact list")

    title = _SIZE_ANALYZER_TITLE_BASE

    analyzed_count = 0
    processing_count = 0
    errored_count = 0

    for artifact in artifacts:
        if artifact.state == PreprodArtifact.ArtifactState.FAILED:
            errored_count += 1
        elif artifact.state == PreprodArtifact.ArtifactState.PROCESSED:
            # Check if size analysis is completed using preloaded metrics
            size_metrics = size_metrics_map.get(artifact.id)
            if (
                size_metrics
                and size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
            ):
                analyzed_count += 1
            else:
                # Artifact is processed but analysis is still pending -> count as processing
                processing_count += 1
        else:
            # UPLOADING or UPLOADED states
            processing_count += 1

    # Build subtitle with counts
    parts = []
    if analyzed_count > 0:
        parts.append(
            ngettext("1 build analyzed", "{} builds analyzed", analyzed_count).format(
                analyzed_count
            )
        )
    if processing_count > 0:
        parts.append(
            ngettext("1 build processing", "{} builds processing", processing_count).format(
                processing_count
            )
        )
    if errored_count > 0:
        parts.append(
            ngettext("1 build errored", "{} builds errored", errored_count).format(errored_count)
        )

    subtitle = ", ".join(parts)

    # Determine overall status
    if errored_count > 0:
        overall_status = _OverallStatus.FAILED
    elif processing_count > 0:
        overall_status = _OverallStatus.PROCESSING
    else:
        overall_status = _OverallStatus.SUCCESS

    # Generate summary table
    match overall_status:
        case _OverallStatus.PROCESSING:
            summary = _format_processing_summary(artifacts, size_metrics_map)
        case _OverallStatus.FAILED:
            summary = _format_failure_summary(artifacts)
        case _OverallStatus.SUCCESS:
            summary = _format_success_summary(artifacts, size_metrics_map)

    return str(title), str(subtitle), str(summary)


def _format_processing_summary(
    artifacts: list[PreprodArtifact], size_metrics_map: dict[int, PreprodArtifactSizeMetrics]
) -> str:
    """Format summary for artifacts in mixed processing/analyzed state."""
    table_rows = []
    for artifact in artifacts:
        version_parts = []
        if artifact.build_version:
            version_parts.append(artifact.build_version)
        if artifact.build_number:
            version_parts.append(f"({artifact.build_number})")
        version_string = " ".join(version_parts) if version_parts else _("Unknown")

        # Check if this specific artifact is analyzed or still processing
        if artifact.state == PreprodArtifact.ArtifactState.PROCESSED:
            size_metrics = size_metrics_map.get(artifact.id)
            if (
                size_metrics
                and size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
            ):
                # This artifact is analyzed - show actual sizes
                download_size = _format_file_size(size_metrics.max_download_size)
                install_size = _format_file_size(size_metrics.max_install_size)
                download_change = _("N/A")
                install_change = _("N/A")
                table_rows.append(
                    f"| `{artifact.app_id or '--'}` | {version_string} | {download_size} | {download_change} | {install_size} | {install_change} | {_('N/A')} |"
                )
                continue

        # This artifact is still processing
        table_rows.append(
            f"| `{artifact.app_id or '--'}` | {version_string} | {_('Processing...')} | - | {_('Processing...')} | - | {_('N/A')} |"
        )

    return _(
        "| Name | Version | Download | Change | Install | Change | Approval |\n"
        "|------|---------|----------|--------|---------|--------|----------|\n"
        "{table_rows}"
    ).format(table_rows="\n".join(table_rows))


def _format_failure_summary(artifacts: list[PreprodArtifact]) -> str:
    """Format summary for multiple artifacts with failures."""
    table_rows = []
    for artifact in artifacts:
        version_parts = []
        if artifact.build_version:
            version_parts.append(artifact.build_version)
        if artifact.build_number:
            version_parts.append(f"({artifact.build_number})")
        version_string = " ".join(version_parts) if version_parts else _("Unknown")

        if artifact.state == PreprodArtifact.ArtifactState.FAILED:
            error_msg = artifact.error_message or _("Unknown error")
            table_rows.append(f"| `{artifact.app_id or '--'}` | {version_string} | {error_msg} |")
        else:
            # Show successful/processing ones too in mixed state
            table_rows.append(
                f"| `{artifact.app_id or '--'}` | {version_string} | {_('Processing...')} |"
            )

    return _("| Name | Version | Error |\n" "|------|---------|-------|\n" "{table_rows}").format(
        table_rows="\n".join(table_rows)
    )


def _format_success_summary(
    artifacts: list[PreprodArtifact], size_metrics_map: dict[int, PreprodArtifactSizeMetrics]
) -> str:
    """Format summary for multiple successful artifacts with size data."""
    table_rows = []
    for artifact in artifacts:
        version_parts = []
        if artifact.build_version:
            version_parts.append(artifact.build_version)
        if artifact.build_number:
            version_parts.append(f"({artifact.build_number})")
        version_string = " ".join(version_parts) if version_parts else _("Unknown")

        # Get size metrics from preloaded map
        size_metrics = size_metrics_map.get(artifact.id)

        if (
            size_metrics
            and size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
        ):
            download_size = _format_file_size(size_metrics.max_download_size)
            install_size = _format_file_size(size_metrics.max_install_size)
            # TODO: Calculate actual size changes
            download_change = str(_("N/A"))
            install_change = str(_("N/A"))
        else:
            download_size = str(_("Unknown"))
            install_size = str(_("Unknown"))
            download_change = "-"
            install_change = "-"

        table_rows.append(
            f"| `{artifact.app_id or '--'}` | {version_string} | {download_size} | {download_change} | {install_size} | {install_change} | {_('N/A')} |"
        )

    return _(
        "| Name | Version | Download | Change | Install | Change | Approval |\n"
        "|------|---------|----------|--------|---------|--------|----------|\n"
        "{table_rows}"
    ).format(table_rows="\n".join(table_rows))


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
