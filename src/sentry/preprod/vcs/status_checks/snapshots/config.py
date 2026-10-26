from __future__ import annotations

from dataclasses import dataclass

from sentry.models.project import Project
from sentry.preprod.snapshots.utils import SnapshotChangeCriteria

ENABLED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_enabled"
FAIL_ON_ADDED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_added"
FAIL_ON_REMOVED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_removed"
FAIL_ON_CHANGED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_changed"
FAIL_ON_RENAMED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_renamed"

ENABLED_DEFAULT = True
FAIL_ON_ADDED_DEFAULT = False
FAIL_ON_REMOVED_DEFAULT = True
FAIL_ON_CHANGED_DEFAULT = True
FAIL_ON_RENAMED_DEFAULT = False


@dataclass(frozen=True)
class SnapshotApprovalPolicy:
    """Whether snapshot approval is active and which change categories require it."""

    enabled: bool
    criteria: SnapshotChangeCriteria


def get_snapshot_approval_policy(project: Project) -> SnapshotApprovalPolicy:
    """Return the project's effective snapshot approval policy."""
    enabled = project.get_option(ENABLED_OPTION_KEY, default=ENABLED_DEFAULT)
    if not enabled:
        return SnapshotApprovalPolicy(
            enabled=False,
            criteria=SnapshotChangeCriteria(
                added=False,
                removed=False,
                changed=False,
                renamed=False,
            ),
        )

    return SnapshotApprovalPolicy(
        enabled=True,
        criteria=SnapshotChangeCriteria(
            added=project.get_option(FAIL_ON_ADDED_OPTION_KEY, default=FAIL_ON_ADDED_DEFAULT),
            removed=project.get_option(FAIL_ON_REMOVED_OPTION_KEY, default=FAIL_ON_REMOVED_DEFAULT),
            changed=project.get_option(FAIL_ON_CHANGED_OPTION_KEY, default=FAIL_ON_CHANGED_DEFAULT),
            renamed=project.get_option(FAIL_ON_RENAMED_OPTION_KEY, default=FAIL_ON_RENAMED_DEFAULT),
        ),
    )
