from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from sentry.models.project import Project
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.url_utils import get_preprod_artifact_comparison_url, get_preprod_artifact_url
from sentry.preprod.vcs.markdown_utils import escape_markdown, escape_markdown_code

_HEADER = "## Sentry Snapshot Testing"
PROCESSING_STATUS = "⏳ Processing"
COMPARISON_TABLE_HEADER = (
    "| Name | Added | Removed | Changed | Renamed | Unchanged | Skipped | Status |\n"
    "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n"
)


def format_errored_note(total_errored: int) -> str:
    if total_errored <= 0:
        return ""
    return str(
        ngettext(
            "⚠️ %(count)d image failed to compare",
            "⚠️ %(count)d images failed to compare",
            total_errored,
        )
        % {"count": total_errored}
    )


def format_snapshot_pr_comment(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    base_artifact_map: dict[int, PreprodArtifact],
    changes_map: dict[int, bool],
    approvals_map: dict[int, PreprodComparisonApproval] | None = None,
    *,
    project: Project,
) -> str:
    if not artifacts:
        raise ValueError("Cannot format PR comment for empty artifact list")

    table_rows = []
    total_errored = 0

    for artifact in artifacts:
        metrics = snapshot_metrics_map.get(artifact.id)
        comparison = comparisons_map.get(metrics.id) if metrics else None
        include_selected_types = comparison is not None and comparison.state not in (
            PreprodSnapshotComparison.State.PENDING,
            PreprodSnapshotComparison.State.PROCESSING,
            PreprodSnapshotComparison.State.FAILED,
        )
        name_cell = _name_cell(
            artifact,
            snapshot_metrics_map,
            base_artifact_map,
            comparison=comparison if include_selected_types else None,
        )

        if not metrics:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | - | {PROCESSING_STATUS} |")
            continue

        has_base = artifact.id in base_artifact_map

        if not comparison and not has_base:
            # No base to compare against — show snapshot count only
            table_rows.append(
                f"| {name_cell} | - | - | - | - | - | - | ✅ {metrics.image_count} uploaded |"
            )
            continue

        if not comparison:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | - | {PROCESSING_STATUS} |")
            continue

        if comparison.state in (
            PreprodSnapshotComparison.State.PENDING,
            PreprodSnapshotComparison.State.PROCESSING,
        ):
            table_rows.append(f"| {name_cell} | - | - | - | - | - | - | {PROCESSING_STATUS} |")
        elif comparison.state == PreprodSnapshotComparison.State.FAILED:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | - | ❌ Comparison failed |")
        else:
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
                f" | {comparison.images_added}"
                f" | {comparison.images_removed}"
                f" | {comparison.images_changed}"
                f" | {comparison.images_renamed}"
                f" | {comparison.images_unchanged}"
                f" | {comparison.images_skipped}"
                f" | {status} |"
            )
            total_errored += comparison.images_errored

    table = f"{_HEADER}\n\n{COMPARISON_TABLE_HEADER}" + "\n".join(table_rows)
    errored_note = format_errored_note(total_errored)
    if errored_note:
        table += f"\n\n{errored_note}"
    settings_link = _format_settings_link(project)

    return f"{table}\n\n{settings_link}"


def _name_cell(
    artifact: PreprodArtifact,
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    base_artifact_map: dict[int, PreprodArtifact],
    comparison: PreprodSnapshotComparison | None = None,
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

    if comparison is not None:
        artifact_url += _selected_types_query(comparison)

    return _format_name_cell(app_display, app_id, artifact_url)


def _app_display_info(artifact: PreprodArtifact) -> tuple[str, str]:
    mobile_app_info = getattr(artifact, "mobile_app_info", None)
    app_name = mobile_app_info.app_name if mobile_app_info else None
    app_display = app_name or artifact.app_id or str(_("Unknown App"))
    app_id = artifact.app_id or ""
    return app_display, app_id


def _format_name_cell(app_display: str, app_id: str, url: str) -> str:
    # app_display / app_id are untrusted artifact metadata; url is Sentry-generated.
    app_display = escape_markdown(app_display)
    if app_id:
        return f"[{app_display}]({url})<br>`{escape_markdown_code(app_id)}`"
    return f"[{app_display}]({url})"


def _selected_types_query(comparison: PreprodSnapshotComparison) -> str:
    counts = (
        ("added", comparison.images_added),
        ("removed", comparison.images_removed),
        ("changed", comparison.images_changed),
        ("renamed", comparison.images_renamed),
    )
    selected = [name for name, count in counts if count > 0]
    if not selected:
        return ""
    return f"?selectedTypes={','.join(selected)}"


def _format_settings_link(project: Project) -> str:
    settings_url = project.organization.absolute_url(
        f"/settings/projects/{project.slug}/mobile-builds/", query="tab=snapshots"
    )
    return f"[⚙️ {project.name} Snapshot Settings]({settings_url})"


def _format_solo_table(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
) -> str:
    table_rows = []
    for artifact in artifacts:
        app_display, app_id = _app_display_info(artifact)
        artifact_url = get_preprod_artifact_url(artifact, view_type="snapshots")
        name_cell = _format_name_cell(app_display, app_id, artifact_url)
        metrics = snapshot_metrics_map.get(artifact.id)
        if metrics:
            table_rows.append(
                f"| {name_cell} | - | - | - | - | - | - | ✅ {metrics.image_count} uploaded |"
            )
        else:
            table_rows.append(f"| {name_cell} | - | - | - | - | - | - | {PROCESSING_STATUS} |")
    return f"{_HEADER}\n\n{COMPARISON_TABLE_HEADER}" + "\n".join(table_rows)


_SOLO_MESSAGE = "Snapshot diffs will appear when we have a base upload to compare against. Make sure to upload snapshots from your main branch."
_WAITING_MESSAGE = "Waiting for base snapshots to finish uploading. This comment will update automatically within ~10 minutes or fail."
_MISSING_BASE_MESSAGE = "No base snapshots found to compare against. Make sure snapshots are uploaded from your main branch."


def _format_solo_comment(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    message: str,
    *,
    project: Project,
) -> str:
    if not artifacts:
        raise ValueError("Cannot format PR comment for empty artifact list")
    table = _format_solo_table(artifacts, snapshot_metrics_map)
    return f"{table}\n\n{message}\n\n{_format_settings_link(project)}"


def format_solo_snapshot_pr_comment(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    *,
    project: Project,
) -> str:
    return _format_solo_comment(artifacts, snapshot_metrics_map, _SOLO_MESSAGE, project=project)


def format_waiting_for_base_snapshot_pr_comment(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    *,
    project: Project,
) -> str:
    return _format_solo_comment(artifacts, snapshot_metrics_map, _WAITING_MESSAGE, project=project)


def format_missing_base_snapshot_pr_comment(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    *,
    project: Project,
) -> str:
    return _format_solo_comment(
        artifacts, snapshot_metrics_map, _MISSING_BASE_MESSAGE, project=project
    )
