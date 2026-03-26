from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.url_utils import get_preprod_artifact_comparison_url, get_preprod_artifact_url

_SNAPSHOT_TITLE_BASE = _("Snapshot Testing")
_PROCESSING_STATUS = "⏳ Processing"


def format_snapshot_status_check_messages(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    overall_status: StatusCheckStatus,
    base_artifact_map: dict[int, PreprodArtifact],
) -> tuple[str, str, str]:
    if not artifacts:
        raise ValueError("Cannot format messages for empty artifact list")

    title = _SNAPSHOT_TITLE_BASE

    total_changed = 0
    total_added = 0
    total_removed = 0
    total_renamed = 0
    total_unchanged = 0

    for artifact in artifacts:
        metrics = snapshot_metrics_map.get(artifact.id)
        if not metrics:
            continue

        comparison = comparisons_map.get(metrics.id)
        if not comparison:
            continue

        if comparison.state == PreprodSnapshotComparison.State.FAILED:
            subtitle = str(_("We had trouble comparing snapshots, our team is investigating."))
            return str(title), str(subtitle), ""

        if comparison.state == PreprodSnapshotComparison.State.SUCCESS:
            total_changed += comparison.images_changed
            total_added += comparison.images_added
            total_removed += comparison.images_removed
            total_renamed += comparison.images_renamed
            total_unchanged += comparison.images_unchanged

    if overall_status == StatusCheckStatus.IN_PROGRESS:
        subtitle = str(_("Comparing snapshots..."))
    elif total_changed == 0 and total_added == 0 and total_removed == 0 and total_renamed == 0:
        subtitle = str(_("No changes detected"))
    else:
        parts = []
        if total_changed > 0:
            parts.append(
                ngettext(
                    "%(count)d modified",
                    "%(count)d modified",
                    total_changed,
                )
                % {"count": total_changed}
            )
        if total_added > 0:
            parts.append(
                ngettext(
                    "%(count)d added",
                    "%(count)d added",
                    total_added,
                )
                % {"count": total_added}
            )
        if total_removed > 0:
            parts.append(
                ngettext(
                    "%(count)d removed",
                    "%(count)d removed",
                    total_removed,
                )
                % {"count": total_removed}
            )
        if total_renamed > 0:
            parts.append(
                ngettext(
                    "%(count)d renamed",
                    "%(count)d renamed",
                    total_renamed,
                )
                % {"count": total_renamed}
            )
        if total_unchanged > 0:
            parts.append(
                ngettext(
                    "%(count)d unchanged",
                    "%(count)d unchanged",
                    total_unchanged,
                )
                % {"count": total_unchanged}
            )
        subtitle = ", ".join(str(p) for p in parts)

    summary = _format_snapshot_summary(
        artifacts,
        snapshot_metrics_map,
        comparisons_map,
        base_artifact_map,
    )

    return str(title), str(subtitle), str(summary)


def format_first_snapshot_status_check_messages(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
) -> tuple[str, str, str]:
    if not artifacts:
        raise ValueError("Cannot format messages for empty artifact list")

    title = _SNAPSHOT_TITLE_BASE

    total_images = 0
    for artifact in artifacts:
        metrics = snapshot_metrics_map.get(artifact.id)
        if metrics:
            total_images += metrics.image_count

    subtitle = ngettext(
        "%(count)d snapshot uploaded",
        "%(count)d snapshots uploaded",
        total_images,
    ) % {"count": total_images}

    summary = _format_solo_snapshot_summary(artifacts, snapshot_metrics_map)
    summary += "\n\nThis looks like your first snapshot upload. Snapshot diffs will appear when we have a base upload to compare against. Make sure to upload snapshots from your main branch."

    return str(title), str(subtitle), str(summary)


def format_generated_snapshot_status_check_messages(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
) -> tuple[str, str, str]:
    if not artifacts:
        raise ValueError("Cannot format messages for empty artifact list")

    title = _SNAPSHOT_TITLE_BASE

    total_images = 0
    for artifact in artifacts:
        metrics = snapshot_metrics_map.get(artifact.id)
        if metrics:
            total_images += metrics.image_count

    subtitle = ngettext(
        "Generated %(count)d snapshot",
        "Generated %(count)d snapshots",
        total_images,
    ) % {"count": total_images}

    summary = _format_solo_snapshot_summary(artifacts, snapshot_metrics_map)

    return str(title), str(subtitle), str(summary)


def format_missing_base_snapshot_status_check_messages(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
) -> tuple[str, str, str]:
    if not artifacts:
        raise ValueError("Cannot format messages for empty artifact list")

    title = _SNAPSHOT_TITLE_BASE
    subtitle = str(_("No base snapshots found"))

    summary = _format_solo_snapshot_summary(artifacts, snapshot_metrics_map)
    summary += "\n\nNo base snapshots found to compare against. Make sure snapshots are uploaded from your main branch."

    return str(title), str(subtitle), str(summary)


def _format_solo_snapshot_summary(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
) -> str:
    table_rows = []

    for artifact in artifacts:
        mobile_app_info = getattr(artifact, "mobile_app_info", None)
        app_name = mobile_app_info.app_name if mobile_app_info else None
        app_display = app_name or artifact.app_id or str(_("Unknown App"))
        app_id = artifact.app_id or ""

        artifact_url = get_preprod_artifact_url(artifact, view_type="snapshots")

        name_cell = (
            f"[{app_display}]({artifact_url})<br>`{app_id}`"
            if app_id
            else f"[{app_display}]({artifact_url})"
        )

        metrics = snapshot_metrics_map.get(artifact.id)
        if not metrics:
            table_rows.append(f"| {name_cell} | - | {_PROCESSING_STATUS} |")
            continue

        table_rows.append(f"| {name_cell} | {metrics.image_count} | ✅ Uploaded |")

    table_header = "| Name | Snapshots | Status |\n| :--- | :---: | :---: |\n"

    return table_header + "\n".join(table_rows)


def _format_snapshot_summary(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    base_artifact_map: dict[int, PreprodArtifact],
) -> str:
    table_rows = []

    for artifact in artifacts:
        mobile_app_info = getattr(artifact, "mobile_app_info", None)
        app_name = mobile_app_info.app_name if mobile_app_info else None
        app_display = app_name or artifact.app_id or str(_("Unknown App"))
        app_id = artifact.app_id or ""

        metrics = snapshot_metrics_map.get(artifact.id)
        base_artifact = base_artifact_map.get(artifact.id)

        if base_artifact and metrics:
            artifact_url = get_preprod_artifact_comparison_url(
                artifact, base_artifact, comparison_type="snapshots"
            )
        else:
            artifact_url = get_preprod_artifact_url(artifact, view_type="snapshots")

        name_cell = (
            f"[{app_display}]({artifact_url})<br>`{app_id}`"
            if app_id
            else f"[{app_display}]({artifact_url})"
        )

        if not metrics:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | {_PROCESSING_STATUS} |")
            continue

        comparison = comparisons_map.get(metrics.id)
        if not comparison:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | {_PROCESSING_STATUS} |")
            continue

        if comparison.state in (
            PreprodSnapshotComparison.State.PENDING,
            PreprodSnapshotComparison.State.PROCESSING,
        ):
            table_rows.append(f"| {name_cell} | - | - | - | - | - | {_PROCESSING_STATUS} |")
        else:
            added = comparison.images_added
            removed = comparison.images_removed
            modified = comparison.images_changed
            renamed = comparison.images_renamed
            unchanged = comparison.images_unchanged
            has_changes = modified > 0 or added > 0 or removed > 0 or renamed > 0
            status = "⏳ Needs approval" if has_changes else "✅ Unchanged"

            def _section_cell(count: int, section: str) -> str:
                if count > 0:
                    section_url = f"{artifact_url}?section={section}"
                    return f"[{count}]({section_url})"
                return str(count)

            table_rows.append(
                f"| {name_cell}"
                f" | {_section_cell(added, 'added')}"
                f" | {_section_cell(removed, 'removed')}"
                f" | {_section_cell(modified, 'changed')}"
                f" | {_section_cell(renamed, 'renamed')}"
                f" | {_section_cell(unchanged, 'unchanged')}"
                f" | {status} |"
            )

    table_header = (
        "| Name | Added | Removed | Modified | Renamed | Unchanged | Status |\n"
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
    )

    return table_header + "\n".join(table_rows)
