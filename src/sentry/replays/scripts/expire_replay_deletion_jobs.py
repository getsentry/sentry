from __future__ import annotations

import logging
from collections.abc import Sequence

from django.utils import timezone

from sentry.models.project import Project
from sentry.replays.models import DeletionJobStatus, ReplayDeletionJobModel

logger = logging.getLogger()


def expire_replay_deletion_jobs(
    project_id: int, job_ids: Sequence[int], dry_run: bool
) -> list[int]:
    """Mark a project's deletion jobs completed because we deleted the replays ourselves.

    When a customer's bulk deletion job fails we sometimes finish the deletion out-of-band with
    `delete_replays`. The job row is left in a non-completed status, so the UI keeps claiming a
    deletion is in flight and polls the audit log forever. This closes those rows out.

    Jobs are looked up scoped to `project_id`, so a job ID belonging to another project is reported
    as not found rather than expired.

    Returns the IDs that were (or, on a dry run, would have been) transitioned.

    Raises `Project.DoesNotExist` for an unknown `project_id`. An operator supplies that ID by hand,
    so a typo has to fail the run loudly rather than report zero jobs expired and look like success.
    """
    project = Project.objects.filter(id=project_id).first()
    if project is None:
        raise Project.DoesNotExist(
            f"expire_replay_deletion_jobs got project_id={project_id}, which does not exist"
        )

    jobs = list(
        ReplayDeletionJobModel.objects.filter(
            organization_id=project.organization_id,
            project_id=project.id,
            id__in=job_ids,
        )
    )

    expirable_ids = []
    for job in jobs:
        logging_context = {
            "job_id": job.id,
            "organization_id": job.organization_id,
            "project_id": job.project_id,
            "status": job.status,
            "range_start": job.range_start,
            "range_end": job.range_end,
            # `job.query` is deliberately absent: it is a customer-authored search string and can
            # carry PII like `user.email:`. `tasks.py` leaves it out of its Sentry context too.
            "offset": job.offset,
            "dry_run": dry_run,
        }
        if job.status == DeletionJobStatus.COMPLETED:
            logger.info("Replay deletion job is already completed.", extra=logging_context)
        else:
            # `failed` is expirable too, and is the common case: the customer's job failed, so we
            # ran the deletion by hand.
            expirable_ids.append(job.id)
            logger.info("Expiring replay deletion job.", extra=logging_context)

    missing_ids = sorted(set(job_ids) - {job.id for job in jobs})
    if missing_ids:
        logger.warning(
            "Replay deletion jobs not found in project.",
            extra={"project_id": project.id, "job_ids": missing_ids},
        )

    if expirable_ids and not dry_run:
        # Compare-and-set, mirroring `_transition_status` in tasks.py. `date_updated` is set by hand
        # because `auto_now` does not fire on `.update()`. A chained activation of
        # `run_bulk_replay_delete_job` that is still in flight re-reads the status and returns early
        # on anything that isn't `in-progress`, so there is nothing to revoke here.
        ReplayDeletionJobModel.objects.filter(
            organization_id=project.organization_id,
            project_id=project.id,
            id__in=expirable_ids,
        ).exclude(status=DeletionJobStatus.COMPLETED).update(
            status=DeletionJobStatus.COMPLETED, date_updated=timezone.now()
        )

    logger.info(
        "Expired replay deletion jobs.",
        extra={
            "project_id": project.id,
            "expired_job_ids": expirable_ids,
            "expired_count": len(expirable_ids),
            "dry_run": dry_run,
        },
    )

    return expirable_ids
