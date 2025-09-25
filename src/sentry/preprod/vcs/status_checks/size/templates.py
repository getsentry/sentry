from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.url_utils import get_preprod_artifact_comparison_url, get_preprod_artifact_url

_SIZE_ANALYZER_TITLE_BASE = _("Size Analysis")


def format_status_check_messages(
    artifacts: list[PreprodArtifact],
    size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]],
    overall_status: StatusCheckStatus,
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
            size_metrics_list = size_metrics_map.get(artifact.id, [])
            if size_metrics_list and all(
                metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
                for metrics in size_metrics_list
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

    match overall_status:
        case StatusCheckStatus.IN_PROGRESS:
            summary = _format_processing_summary(artifacts, size_metrics_map)
        case StatusCheckStatus.FAILURE:
            summary = _format_failure_summary(artifacts)
        case StatusCheckStatus.SUCCESS:
            summary = _format_success_summary(artifacts, size_metrics_map)

    return str(title), str(subtitle), str(summary)


def _format_processing_summary(
    artifacts: list[PreprodArtifact], size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]]
) -> str:
    """Format summary for artifacts in mixed processing/analyzed state."""
    table_rows = []
    artifact_metric_rows = _create_sorted_artifact_metric_rows(artifacts, size_metrics_map)

    for artifact, size_metrics in artifact_metric_rows:
        version_parts = []
        if artifact.build_version:
            version_parts.append(artifact.build_version)
        if artifact.build_number:
            version_parts.append(f"({artifact.build_number})")
        version_string = " ".join(version_parts) if version_parts else _("Unknown")

        metric_type_display = _get_metric_type_display_name(
            size_metrics.metrics_artifact_type if size_metrics else None
        )
        if metric_type_display:
            app_id = f"{artifact.app_id or '--'} {metric_type_display}"
        else:
            app_id = artifact.app_id or "--"

        artifact_url = get_preprod_artifact_url(artifact)
        app_id_link = f"[`{app_id}`]({artifact_url})"

        if (
            artifact.state == PreprodArtifact.ArtifactState.PROCESSED
            and size_metrics
            and size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
        ):
            download_size = _format_file_size(size_metrics.max_download_size)
            install_size = _format_file_size(size_metrics.max_install_size)

            # Get base metrics for comparison
            base_artifact = artifact.get_base_artifact_for_commit().first()
            base_metrics = (
                base_artifact.get_size_metrics(
                    metrics_artifact_type=size_metrics.metrics_artifact_type,
                    identifier=size_metrics.identifier,
                ).first()
                if base_artifact
                else None
            )

            if base_metrics:
                download_change = _calculate_size_change(
                    size_metrics.max_download_size, base_metrics.max_download_size
                )
                install_change = _calculate_size_change(
                    size_metrics.max_install_size, base_metrics.max_install_size
                )
            else:
                download_change = str(_("N/A"))
                install_change = str(_("N/A"))

            table_rows.append(
                f"| {app_id_link} | {version_string} | {download_size} | {download_change} | {install_size} | {install_change} | {_('N/A')} |"
            )
        else:
            # This metric is still processing
            table_rows.append(
                f"| {app_id_link} | {version_string} | {_('Processing...')} | - | {_('Processing...')} | - | {_('N/A')} |"
            )

    install_label = _("Uncompressed") if artifact.is_android() else _("Install")
    return _(
        "| Name | Version | Download | Change | {install_label} | Change | Approval |\n"
        "|------|---------|----------|--------|---------|--------|----------|\n"
        "{table_rows}"
    ).format(table_rows="\n".join(table_rows), install_label=install_label)


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

        artifact_url = get_preprod_artifact_url(artifact)
        app_id_link = f"[`{artifact.app_id or '--'}`]({artifact_url})"

        if artifact.state == PreprodArtifact.ArtifactState.FAILED:
            error_msg = artifact.error_message or _("Unknown error")
            table_rows.append(f"| {app_id_link} | {version_string} | {error_msg} |")
        else:
            # Show successful/processing ones too in mixed state
            table_rows.append(f"| {app_id_link} | {version_string} | {_('Processing...')} |")

    return _("| Name | Version | Error |\n" "|------|---------|-------|\n" "{table_rows}").format(
        table_rows="\n".join(table_rows)
    )


def _format_success_summary(
    artifacts: list[PreprodArtifact], size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]]
) -> str:
    """Format summary for multiple successful artifacts with size data."""
    table_rows = []
    artifact_metric_rows = _create_sorted_artifact_metric_rows(artifacts, size_metrics_map)

    for artifact, size_metrics in artifact_metric_rows:
        version_parts = []
        if artifact.build_version:
            version_parts.append(artifact.build_version)
        if artifact.build_number:
            version_parts.append(f"({artifact.build_number})")
        version_string = " ".join(version_parts) if version_parts else _("Unknown")

        metric_type_display = _get_metric_type_display_name(
            size_metrics.metrics_artifact_type if size_metrics else None
        )
        if metric_type_display:
            app_id = f"{artifact.app_id or '--'} {metric_type_display}"
        else:
            app_id = artifact.app_id or "--"

        artifact_url = get_preprod_artifact_url(artifact)

        if (
            size_metrics
            and size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
        ):
            download_size = _format_file_size(size_metrics.max_download_size)
            install_size = _format_file_size(size_metrics.max_install_size)

            # Get base metrics for comparison
            base_artifact = artifact.get_base_artifact_for_commit().first()
            base_metrics = (
                base_artifact.get_size_metrics(
                    metrics_artifact_type=size_metrics.metrics_artifact_type,
                    identifier=size_metrics.identifier,
                ).first()
                if base_artifact
                else None
            )

            if base_artifact and base_metrics:
                download_change = _calculate_size_change(
                    size_metrics.max_download_size, base_metrics.max_download_size
                )
                install_change = _calculate_size_change(
                    size_metrics.max_install_size, base_metrics.max_install_size
                )
                artifact_url = get_preprod_artifact_comparison_url(artifact, base_artifact)
            else:
                download_change = str(_("N/A"))
                install_change = str(_("N/A"))
        else:
            download_size = str(_("Unknown"))
            install_size = str(_("Unknown"))
            download_change = "-"
            install_change = "-"

        app_id_link = f"[`{app_id}`]({artifact_url})"
        table_rows.append(
            f"| {app_id_link} | {version_string} | {download_size} | {download_change} | {install_size} | {install_change} | {_('N/A')} |"
        )

    install_label = _("Uncompressed") if artifact.is_android() else _("Install")
    return _(
        "| Name | Version | Download | Change | {install_label} | Change | Approval |\n"
        "|------|---------|----------|--------|---------|--------|----------|\n"
        "{table_rows}"
    ).format(table_rows="\n".join(table_rows), install_label=install_label)


def _get_metric_type_display_name(
    metric_type: PreprodArtifactSizeMetrics.MetricsArtifactType | None,
) -> str | None:
    """Get display name for a metric type."""
    match metric_type:
        case PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT:
            return None
        case PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT:
            return "(Watch)"
        case PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE:
            return "(Dynamic Feature)"
        case _:
            return None


def _create_sorted_artifact_metric_rows(
    artifacts: list[PreprodArtifact], size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]]
) -> list[tuple[PreprodArtifact, PreprodArtifactSizeMetrics | None]]:
    """Create sorted list of (artifact, metric) pairs for display.

    Returns one row per metric type per artifact, sorted so that all metrics for each
    artifact appear together, with MAIN_ARTIFACT first, then WATCH_ARTIFACT, etc.
    """
    rows: list[tuple[PreprodArtifact, PreprodArtifactSizeMetrics | None]] = []

    for artifact in artifacts:
        size_metrics_list = size_metrics_map.get(artifact.id, [])

        if not size_metrics_list:
            # Artifact has no metrics - add a row with None metric
            rows.append((artifact, None))
        else:
            # Sort metrics by type: MAIN_ARTIFACT first, then others
            sorted_metrics = sorted(
                size_metrics_list, key=lambda m: (m.metrics_artifact_type or 0, m.identifier or "")
            )

            for metric in sorted_metrics:
                rows.append((artifact, metric))

    return rows


def _calculate_size_change(head_size: int | None, base_size: int | None) -> str:
    """Calculate size change between head and base.

    Returns:
        str: The formatted size change (e.g., "+1.5 MB", "-500.0 KB", "N/A")
    """
    if head_size is None or base_size is None:
        return str(_("N/A"))

    if base_size == 0:
        if head_size == 0:
            return "0 B"
        else:
            return f"+{_format_file_size(head_size)}"

    absolute_change = head_size - base_size

    # Format absolute change with +/- prefix
    if absolute_change > 0:
        change_display = f"+{_format_file_size(absolute_change)}"
    elif absolute_change < 0:
        change_display = f"-{_format_file_size(abs(absolute_change))}"
    else:
        change_display = "0 B"

    return change_display


def _format_file_size(size_bytes: int | None) -> str:
    """Format file size with null handling for display in templates."""
    if size_bytes is None:
        return "Unknown"
    return _format_bytes_base10(size_bytes)


def _format_bytes_base10(size_bytes: int) -> str:
    """Format file size using decimal (base-10) units. Matches the frontend implementation of formatBytesBase10."""
    units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    threshold = 1000

    if size_bytes < threshold:
        return f"{size_bytes} {units[0]}"

    u = 0
    number = float(size_bytes)
    max_unit = len(units) - 1
    while number >= threshold and u < max_unit:
        number /= threshold
        u += 1

    return f"{number:.1f} {units[u]}"
