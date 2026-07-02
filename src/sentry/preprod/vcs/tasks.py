from __future__ import annotations

from typing import Any


def update_preprod_snapshot_vcs(
    *,
    preprod_artifact_id: int,
    caller: str | None = None,
    is_timeout_check: bool = False,
    update_status_check: bool = True,
    update_pr_comment: bool = True,
    countdown: int | None = None,
) -> None:
    # Lazy imports to avoid circular dependency: the status-check task module
    # imports this function, and we import the task back.
    from sentry.preprod.vcs.pr_comments.snapshot_tasks import (
        create_preprod_snapshot_pr_comment_task,
    )
    from sentry.preprod.vcs.status_checks.snapshots.tasks import (
        create_preprod_snapshot_status_check_task,
    )

    task_kwargs: dict[str, Any] = {
        "preprod_artifact_id": preprod_artifact_id,
        "caller": caller,
        "is_timeout_check": is_timeout_check,
    }
    apply_kwargs: dict[str, Any] = {}
    if countdown is not None:
        apply_kwargs["countdown"] = countdown

    if update_status_check:
        create_preprod_snapshot_status_check_task.apply_async(kwargs=task_kwargs, **apply_kwargs)
    if update_pr_comment:
        create_preprod_snapshot_pr_comment_task.apply_async(kwargs=task_kwargs, **apply_kwargs)
