from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.project import Project
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.url_utils import get_preprod_artifact_comparison_url, get_preprod_artifact_url

_SNAPSHOT_TITLE_BASE = _("Snapshot Testing")


def format_snapshot_status_check_messages(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    overall_status: StatusCheckStatus,
    project: Project,
    base_artifact_map: dict[int, PreprodArtifact],
) -> tuple[str, str, str]:
    if not artifacts:
        raise ValueError("Cannot format messages for empty artifact list")

    title = _SNAPSHOT_TITLE_BASE

    total_changed = 0
    total_added = 0
    total_removed = 0
    errored_count = 0

    for artifact in artifacts:
        metrics = snapshot_metrics_map.get(artifact.id)
        if not metrics:
            continue

        comparison = comparisons_map.get(metrics.id)
        if not comparison:
            continue

        if comparison.state == PreprodSnapshotComparison.State.FAILED:
            errored_count += 1
        elif comparison.state == PreprodSnapshotComparison.State.SUCCESS:
            total_changed += comparison.images_changed
            total_added += comparison.images_added
            total_removed += comparison.images_removed

    if overall_status == StatusCheckStatus.IN_PROGRESS:
        subtitle = str(_("Comparing snapshots..."))
    elif errored_count > 0 and total_changed == 0 and total_added == 0 and total_removed == 0:
        subtitle = str(
            ngettext(
                "%(count)d comparison failed",
                "%(count)d comparisons failed",
                errored_count,
            )
            % {"count": errored_count}
        )
    elif total_changed == 0 and total_added == 0 and total_removed == 0:
        subtitle = str(_("No changes detected"))
    else:
        parts = []
        if total_changed > 0:
            parts.append(
                ngettext(
                    "%(count)d image changed",
                    "%(count)d images changed",
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
        subtitle = ", ".join(str(p) for p in parts)

    summary = _format_snapshot_summary(
        artifacts,
        snapshot_metrics_map,
        comparisons_map,
        base_artifact_map,
        project,
    )

    return str(title), str(subtitle), str(summary)


def _format_snapshot_summary(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    base_artifact_map: dict[int, PreprodArtifact],
    project: Project,
) -> str:
    table_rows = []

    for artifact in artifacts:
        mobile_app_info = getattr(artifact, "mobile_app_info", None)
        app_name = mobile_app_info.app_name if mobile_app_info else None
        app_display = app_name or artifact.app_id or str(_("Unknown App"))

        metrics = snapshot_metrics_map.get(artifact.id)
        base_artifact = base_artifact_map.get(artifact.id)

        if base_artifact and metrics:
            artifact_url = get_preprod_artifact_comparison_url(
                artifact, base_artifact, comparison_type="snapshots"
            )
        else:
            artifact_url = get_preprod_artifact_url(artifact, view_type="snapshots")

        name_link = f"[{app_display}]({artifact_url})"

        if not metrics:
            table_rows.append(f"| {name_link} | Processing... | - | - | - |")
            continue

        comparison = comparisons_map.get(metrics.id)
        if not comparison:
            table_rows.append(f"| {name_link} | Processing... | - | - | - |")
            continue

        if comparison.state in (
            PreprodSnapshotComparison.State.PENDING,
            PreprodSnapshotComparison.State.PROCESSING,
        ):
            table_rows.append(f"| {name_link} | Comparing... | - | - | - |")
        elif comparison.state == PreprodSnapshotComparison.State.FAILED:
            table_rows.append(f"| {name_link} | Failed | - | - | - |")
        else:
            changed = comparison.images_changed
            added = comparison.images_added
            removed = comparison.images_removed
            unchanged = comparison.images_unchanged
            status_emoji = "✅" if (changed == 0 and added == 0 and removed == 0) else "❌"
            table_rows.append(
                f"| {name_link} | {status_emoji} {changed} changed | {added} added | {removed} removed | {unchanged} unchanged |"
            )

    table_header = (
        "| Name | Changed | Added | Removed | Unchanged |\n"
        "|------|---------|-------|---------|-----------|\n"
    )

    settings_url = project.organization.absolute_url(
        f"/settings/projects/{project.slug}/mobile-builds/"
    )
    footer = str(
        _("[Configure {project_name} snapshot settings]({settings_url})").format(
            project_name=project.name,
            settings_url=settings_url,
        )
    )

    return table_header + "\n".join(table_rows) + "\n\n" + footer
