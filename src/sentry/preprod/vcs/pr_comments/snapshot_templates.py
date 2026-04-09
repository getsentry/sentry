from __future__ import annotations

from django.utils.translation import gettext_lazy as _

from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.url_utils import get_preprod_artifact_comparison_url, get_preprod_artifact_url

_HEADER = "## Sentry Snapshot Testing"
PROCESSING_STATUS = "⏳ Processing"
COMPARISON_TABLE_HEADER = (
    "| Name | Added | Removed | Modified | Renamed | Unchanged | Status |\n"
    "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
)


def format_snapshot_pr_comment(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    base_artifact_map: dict[int, PreprodArtifact],
    changes_map: dict[int, bool],
    approvals_map: dict[int, PreprodComparisonApproval] | None = None,
) -> str:
    """Format a PR comment for snapshot comparisons."""
    if not artifacts:
        raise ValueError("Cannot format PR comment for empty artifact list")

    table_rows = []

    for artifact in artifacts:
        name_cell = _name_cell(artifact, snapshot_metrics_map, base_artifact_map)
        metrics = snapshot_metrics_map.get(artifact.id)

        if not metrics:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | {PROCESSING_STATUS} |")
            continue

        comparison = comparisons_map.get(metrics.id)
        has_base = artifact.id in base_artifact_map

        if not comparison and not has_base:
            # No base to compare against — show snapshot count only
            table_rows.append(
                f"| {name_cell} | - | - | - | - | - | ✅ {metrics.image_count} uploaded |"
            )
            continue

        if not comparison:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | {PROCESSING_STATUS} |")
            continue

        if comparison.state in (
            PreprodSnapshotComparison.State.PENDING,
            PreprodSnapshotComparison.State.PROCESSING,
        ):
            table_rows.append(f"| {name_cell} | - | - | - | - | - | {PROCESSING_STATUS} |")
        elif comparison.state == PreprodSnapshotComparison.State.FAILED:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | ❌ Comparison failed |")
        else:
            base_artifact = base_artifact_map.get(artifact.id)
            artifact_url = (
                get_preprod_artifact_comparison_url(
                    artifact, base_artifact, comparison_type="snapshots"
                )
                if base_artifact
                else get_preprod_artifact_url(artifact, view_type="snapshots")
            )

            has_changes = changes_map.get(artifact.id, False)
            is_approved = approvals_map is not None and artifact.id in approvals_map
            if has_changes and is_approved:
                status = "✅ Approved"
            elif has_changes:
                status = "⏳ Needs approval"
            else:
                status = "✅ Unchanged"

            table_rows.append(
                f"| {name_cell}"
                f" | {_section_cell(comparison.images_added, 'added', artifact_url)}"
                f" | {_section_cell(comparison.images_removed, 'removed', artifact_url)}"
                f" | {_section_cell(comparison.images_changed, 'changed', artifact_url)}"
                f" | {_section_cell(comparison.images_renamed, 'renamed', artifact_url)}"
                f" | {_section_cell(comparison.images_unchanged, 'unchanged', artifact_url)}"
                f" | {status} |"
            )

    return f"{_HEADER}\n\n{COMPARISON_TABLE_HEADER}" + "\n".join(table_rows)


def _name_cell(
    artifact: PreprodArtifact,
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    base_artifact_map: dict[int, PreprodArtifact],
) -> str:
    app_display, app_id = _app_display_info(artifact)
    metrics = snapshot_metrics_map.get(artifact.id)
    base_artifact = base_artifact_map.get(artifact.id)

    if base_artifact and metrics:
        artifact_url = get_preprod_artifact_comparison_url(
            artifact, base_artifact, comparison_type="snapshots"
        )
    else:
        artifact_url = get_preprod_artifact_url(artifact, view_type="snapshots")

    return _format_name_cell(app_display, app_id, artifact_url)


def _app_display_info(artifact: PreprodArtifact) -> tuple[str, str]:
    mobile_app_info = getattr(artifact, "mobile_app_info", None)
    app_name = mobile_app_info.app_name if mobile_app_info else None
    app_display = app_name or artifact.app_id or str(_("Unknown App"))
    app_id = artifact.app_id or ""
    return app_display, app_id


def _format_name_cell(app_display: str, app_id: str, url: str) -> str:
    if app_id:
        return f"[{app_display}]({url})<br>`{app_id}`"
    return f"[{app_display}]({url})"


def _section_cell(count: int, section: str, artifact_url: str) -> str:
    if count > 0:
        return f"[{count}]({artifact_url}?section={section})"
    return str(count)
