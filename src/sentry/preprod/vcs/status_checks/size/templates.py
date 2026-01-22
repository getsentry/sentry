from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.project import Project
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.url_utils import get_preprod_artifact_comparison_url, get_preprod_artifact_url
from sentry.preprod.vcs.status_checks.size.types import TriggeredRule

_SIZE_ANALYZER_TITLE_BASE = _("Size Analysis")


def format_status_check_messages(
    artifacts: list[PreprodArtifact],
    size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]],
    overall_status: StatusCheckStatus,
    project: Project,
    triggered_rules: list[TriggeredRule] | None = None,
) -> tuple[str, str, str]:
    """
    Args:
        artifacts: List of PreprodArtifact objects
        size_metrics_map: Dict mapping artifact_id to PreprodArtifactSizeMetrics
        overall_status: The overall status of the check
        project: The project associated with the artifacts
        triggered_rules: List of triggered rules with artifact associations

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
            # Failure summary shows one row per artifact, not per metric
            errored_count += 1
        elif artifact.state == PreprodArtifact.ArtifactState.PROCESSED:
            # Success summaries show one row per metric
            size_metrics_list = size_metrics_map.get(artifact.id, [])

            if size_metrics_list:
                for metrics in size_metrics_list:
                    match metrics.state:
                        case PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING:
                            processing_count += 1
                        case PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING:
                            processing_count += 1
                        case PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED:
                            analyzed_count += 1
                        case PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED:
                            errored_count += 1
                        case _:
                            raise ValueError(f"Unknown size analysis state: {metrics.state}")

        else:
            # UPLOADING or UPLOADED states - artifacts can't have metrics yet
            processing_count += 1

    if analyzed_count == 0 and processing_count == 0 and errored_count == 0:
        raise ValueError("No metrics exist for VCS size status check")

    parts = []
    if analyzed_count > 0:
        parts.append(
            ngettext("%(count)d app analyzed", "%(count)d apps analyzed", analyzed_count)
            % {"count": analyzed_count}
        )
    if processing_count > 0:
        parts.append(
            ngettext("%(count)d app processing", "%(count)d apps processing", processing_count)
            % {"count": processing_count}
        )
    if errored_count > 0:
        parts.append(
            ngettext("%(count)d app errored", "%(count)d apps errored", errored_count)
            % {"count": errored_count}
        )

    subtitle = ", ".join(parts)

    settings_url = _get_settings_url(project, triggered_rules)

    if triggered_rules:
        failed_artifact_ids = {tr.artifact_id for tr in triggered_rules}
        failed_artifacts = [a for a in artifacts if a.id in failed_artifact_ids]
        passed_artifacts = [a for a in artifacts if a.id not in failed_artifact_ids]

        failed_count = len(failed_artifact_ids)
        failed_header = ngettext(
            "## ❌ %(count)d App Failed Size Checks",
            "## ❌ %(count)d Apps Failed Size Checks",
            failed_count,
        ) % {"count": failed_count}

        summary_parts = []

        # Failed apps section
        summary_parts.append(failed_header)
        summary_parts.append(_format_artifact_summary(failed_artifacts, size_metrics_map))
        summary_parts.append(_format_failed_checks_details(triggered_rules, settings_url))

        # Passed apps section (if any)
        if passed_artifacts:
            passed_count = len(passed_artifacts)
            passed_header = ngettext(
                "## %(count)d App Analyzed",
                "## %(count)d Apps Analyzed",
                passed_count,
            ) % {"count": passed_count}
            summary_parts.append(passed_header)
            summary_parts.append(_format_artifact_summary(passed_artifacts, size_metrics_map))

        # Footer link
        summary_parts.append(_format_configure_link(project, settings_url))

        summary = "\n\n".join(summary_parts)

    elif overall_status == StatusCheckStatus.FAILURE:
        # Failed due to processing errors
        summary = _format_failure_summary(artifacts)
        summary += "\n\n" + _format_configure_link(project, settings_url)

    else:
        # Success or in-progress
        summary_parts = []

        if analyzed_count > 0:
            analyzed_header = ngettext(
                "## %(count)d App Analyzed",
                "## %(count)d Apps Analyzed",
                analyzed_count,
            ) % {"count": analyzed_count}
            summary_parts.append(analyzed_header)
        else:
            # All apps still processing
            processing_header = ngettext(
                "## %(count)d App Processing",
                "## %(count)d Apps Processing",
                processing_count,
            ) % {"count": processing_count}
            summary_parts.append(processing_header)

        summary_parts.append(_format_artifact_summary(artifacts, size_metrics_map))
        summary_parts.append(_format_configure_link(project, settings_url))

        summary = "\n\n".join(summary_parts)

    return str(title), str(subtitle), str(summary)


def _format_artifact_summary(
    artifacts: list[PreprodArtifact],
    size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]],
) -> str:
    """Format summary for artifacts with size data."""
    artifact_metric_rows = _create_sorted_artifact_metric_rows(artifacts, size_metrics_map)

    grouped_rows: dict[str, list[str]] = {"android": [], "ios": []}
    group_order: list[str] = []

    for artifact, size_metrics in artifact_metric_rows:
        qualifiers = []

        platform_label = artifact.get_platform_label()
        if platform_label:
            qualifiers.append(platform_label)

        # App name
        metric_type_display = _get_size_metric_type_display_name(
            size_metrics.metrics_artifact_type if size_metrics else None
        )
        if metric_type_display:
            qualifiers.append(metric_type_display)

        mobile_app_info = getattr(artifact, "mobile_app_info", None)
        artifact_app_name = mobile_app_info.app_name if mobile_app_info else None
        app_name = (
            f"{artifact_app_name or '--'}{' (' + ', '.join(qualifiers) + ')' if qualifiers else ''}"
        )

        # App ID
        app_id = artifact.app_id or "--"

        # App version
        version_string = _format_version_string(artifact, default=str(_("Unknown")))

        base_artifact = None
        base_metrics = None
        if (
            size_metrics
            and size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
        ):
            base_artifact = artifact.get_base_artifact_for_commit().first()
            if base_artifact:
                base_metrics = base_artifact.get_size_metrics(
                    metrics_artifact_type=size_metrics.metrics_artifact_type,
                    identifier=size_metrics.identifier,
                ).first()

        # Install + Download sizes
        download_size_display, download_change, install_size_display, install_change = (
            _get_size_metric_display_data(artifact, size_metrics, base_artifact, base_metrics)
        )

        # Comparison URL
        if base_artifact and base_metrics:
            artifact_url = get_preprod_artifact_comparison_url(
                artifact, base_artifact, comparison_type="size"
            )
        else:
            artifact_url = get_preprod_artifact_url(artifact, view_type="size")

        name_text = f"[{app_name}<br>`{app_id}`]({artifact_url})"

        download_text = f"{download_size_display} ({download_change})"
        install_text = f"{install_size_display} ({install_change})"

        # Configuration
        configuration_text = (
            f"{artifact.build_configuration.name or '--'}" if artifact.build_configuration else "--"
        )

        # TODO(preprod): Add approval text once we have it
        na_text = str(_("N/A"))

        row = f"| {name_text} | {configuration_text} | {version_string} | {download_text} | {install_text} | {na_text} |"

        group_key = "android" if artifact.is_android() else "ios"
        grouped_rows[group_key].append(row)
        if group_key not in group_order:
            group_order.append(group_key)

    def _render_table(rows: list[str], install_label: str) -> str:
        return _(
            "| Name | Configuration | Version | Download Size | {install_label} | Approval |\n"
            "|------|--------------|---------|----------|-----------------|----------|\n"
            "{table_rows}"
        ).format(table_rows="\n".join(rows), install_label=install_label)

    tables: list[str] = []
    for group_key in group_order:
        if grouped_rows[group_key]:
            if group_key == "android":
                header = "### Android Builds\n\n"
                table = _render_table(grouped_rows[group_key], str(_("Uncompressed Size")))
                tables.append(f"{header}{table}")
            else:
                header = "### iOS Builds\n\n"
                table = _render_table(grouped_rows[group_key], str(_("Install Size")))
                tables.append(f"{header}{table}")

    return "\n\n".join(tables)


def _format_failure_summary(
    artifacts: list[PreprodArtifact],
) -> str:
    """Format summary for artifacts with processing failures."""
    table_rows = []
    for artifact in artifacts:
        version_string = _format_version_string(artifact, default="-")

        artifact_url = get_preprod_artifact_url(artifact, view_type="size")
        unknown_app_text = str(_("Unknown App"))
        app_id_link = f"[`{artifact.app_id or unknown_app_text}`]({artifact_url})"

        if artifact.state == PreprodArtifact.ArtifactState.FAILED:
            error_msg = artifact.error_message or str(_("Unknown error"))
            table_rows.append(f"| {app_id_link} | {version_string} | {error_msg} |")
        else:
            # Show successful/processing ones too in mixed state
            processing_text = str(_("Processing..."))
            table_rows.append(f"| {app_id_link} | {version_string} | {processing_text} |")

    table = _("| Name | Version | Error |\n" "|------|---------|-------|\n" "{table_rows}").format(
        table_rows="\n".join(table_rows)
    )
    return table


def _get_settings_url(
    project: Project,
    triggered_rules: list[TriggeredRule] | None = None,
) -> str:
    """Build the settings URL for the project's preprod settings page."""
    base_url = f"/settings/projects/{project.slug}/preprod/"
    if triggered_rules:
        expanded_params = "&".join(f"expanded={tr.rule.id}" for tr in triggered_rules)
        return project.organization.absolute_url(base_url, query=expanded_params)
    return project.organization.absolute_url(base_url)


def _format_failed_checks_details(
    triggered_rules: list[TriggeredRule],
    settings_url: str,
) -> str:
    """Format the <details> section for failed checks grouped by bundle."""
    if not triggered_rules:
        return ""

    # Group rules by app_id
    rules_by_app: dict[str, list[TriggeredRule]] = {}
    for tr in triggered_rules:
        app_key = tr.app_id or "Unknown"
        if app_key not in rules_by_app:
            rules_by_app[app_key] = []
        rules_by_app[app_key].append(tr)

    total_failed = len(triggered_rules)
    summary_text = ngettext(
        "%(count)d Failed Check",
        "%(count)d Failed Checks",
        total_failed,
    ) % {"count": total_failed}

    details_content = []
    for app_id, app_rules in rules_by_app.items():
        platform = app_rules[0].platform if app_rules else None
        platform_text = f" ({platform})" if platform else ""
        details_content.append(f"`{app_id}`{platform_text}")

        for tr in app_rules:
            metric_display = _get_metric_display_name(tr.rule.metric)
            measurement_display = _get_measurement_display_name(tr.rule.measurement)
            threshold_display = _format_threshold_value(tr.rule.value, tr.rule.measurement)
            details_content.append(
                f"- **{metric_display} - {measurement_display}** ≥ **{threshold_display}**"
            )

    details_content.append(f"\n⚙️ [Configure status check rules]({settings_url})")

    return (
        f"<details>\n"
        f"<summary>{summary_text}</summary>\n\n"
        f"{chr(10).join(details_content)}\n"
        f"</details>"
    )


def _format_configure_link(project: Project, settings_url: str) -> str:
    """Format the footer link to configure status check rules."""
    return str(
        _("[Configure {project_name} status check rules]({settings_url})").format(
            project_name=project.name,
            settings_url=settings_url,
        )
    )


def _get_metric_display_name(metric: str) -> str:
    """Get human-readable display name for a metric."""
    metric_names = {
        "install_size": str(_("Install Size")),
        "download_size": str(_("Download Size")),
    }
    return metric_names.get(metric, metric.replace("_", " ").title())


def _get_measurement_display_name(measurement: str) -> str:
    """Get human-readable display name for a measurement type."""
    measurement_names = {
        "absolute": str(_("Total Size")),
        "absolute_diff": str(_("Absolute Diff")),
        "relative_diff": str(_("Relative Diff")),
    }
    return measurement_names.get(measurement, measurement.replace("_", " ").title())


def _format_threshold_value(value: float, measurement: str) -> str:
    """Format the threshold value based on measurement type."""
    if measurement == "relative_diff":
        return f"{value}%"
    else:
        # absolute or absolute_diff - value is in bytes
        return _format_file_size(int(value))


def _get_size_metric_display_data(
    artifact: PreprodArtifact,
    size_metrics: PreprodArtifactSizeMetrics | None,
    base_artifact: PreprodArtifact | None,
    base_metrics: PreprodArtifactSizeMetrics | None,
) -> tuple[str, str, str, str]:
    """Get display data for a metric row.

    Returns:
        tuple: (download_size_display, download_change, install_size_display, install_change)
    """
    if (
        size_metrics
        and size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
    ):
        download_size = _format_file_size(size_metrics.max_download_size)
        install_size = _format_file_size(size_metrics.max_install_size)

        if base_artifact and base_metrics:
            download_change = _calculate_size_change(
                size_metrics.max_download_size, base_metrics.max_download_size
            )
            install_change = _calculate_size_change(
                size_metrics.max_install_size, base_metrics.max_install_size
            )
        else:
            download_change = str(_("N/A"))
            install_change = str(_("N/A"))

        return download_size, download_change, install_size, install_change

    elif artifact.state in (
        PreprodArtifact.ArtifactState.UPLOADING,
        PreprodArtifact.ArtifactState.UPLOADED,
    ) or (
        size_metrics
        and size_metrics.state
        in (
            PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
            PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        )
    ):
        processing_text = str(_("Processing..."))
        return processing_text, "-", processing_text, "-"

    else:
        unknown_text = str(_("Unknown"))
        return unknown_text, "-", unknown_text, "-"


def _format_version_string(artifact: PreprodArtifact, default: str = "-") -> str:
    """Format version string from build_version and build_number."""
    version_parts = []
    mobile_app_info = getattr(artifact, "mobile_app_info", None)
    build_version = mobile_app_info.build_version if mobile_app_info else None
    build_number = mobile_app_info.build_number if mobile_app_info else None
    if build_version:
        version_parts.append(build_version)
    if build_number:
        version_parts.append(f"({build_number})")
    return " ".join(version_parts) if version_parts else default


def _get_size_metric_type_display_name(
    metric_type: PreprodArtifactSizeMetrics.MetricsArtifactType | None,
) -> str | None:
    """Get display name for a metric type."""
    match metric_type:
        case PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT:
            return None
        case PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT:
            return "Watch"
        case PreprodArtifactSizeMetrics.MetricsArtifactType.ANDROID_DYNAMIC_FEATURE:
            return "Dynamic Feature"
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
