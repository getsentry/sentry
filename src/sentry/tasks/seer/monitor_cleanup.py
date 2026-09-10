from __future__ import annotations

import logging
from datetime import timedelta

from django.db import router, transaction
from django.utils import timezone

from sentry import features
from sentry.auth import access
from sentry.models.project import Project
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.monitor_cleanup import (
    ARTIFACT_KEY,
    FEATURE,
    MONITOR_CLEANUP_PROMPT,
    MonitorCleanupArtifact,
    MonitorCleanupCompletionHook,
    validate_monitor_cleanup,
)
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.users.services.user.service import user_service
from sentry.viewer_context import ActorType, ViewerContext, viewer_context_scope

logger = logging.getLogger(__name__)
RUN_TIMEOUT = timedelta(minutes=15)
TERMINAL = {"complete", "partial", "failed"}


def finish_shard(
    shard_id: int, *, output: dict[str, object] | None = None, error: str | None = None
) -> None:
    shard = SeerNightShiftRunShard.objects.filter(id=shard_id).first()
    if shard is None:
        return
    with transaction.atomic(router.db_for_write(SeerNightShiftRun)):
        run = SeerNightShiftRun.objects.select_for_update().filter(id=shard.run_id).first()
        if run is None:
            return
        shard = (
            SeerNightShiftRunShard.objects.select_related("seer_run").filter(id=shard_id).first()
        )
        if shard is None or shard.extras.get("status") in TERMINAL:
            return
        if output is not None:
            SeerNightShiftRunResult.objects.get_or_create(
                run=run,
                kind=SeerWorkflowStrategy.DUPLICATE_MONITORS,
                idempotency_key=f"project:{shard.extras['project_id']}",
                defaults={"result_seer_run": shard.seer_run, "extras": output},
            )
        scan = output.get("scan") if output else None
        status = "failed" if error else "complete"
        if isinstance(scan, dict) and scan.get("status") == "partial":
            status = "partial"
        shard.update(extras={**shard.extras, "status": status, "error": error})
        states = list(run.shards.values_list("extras", flat=True))
        coverage = {
            "total": len(states),
            "complete": sum(s.get("status") == "complete" for s in states),
            "partial": sum(s.get("status") == "partial" for s in states),
            "failed": sum(s.get("status") == "failed" for s in states),
        }
        done = all(s.get("status") in TERMINAL for s in states)
        run_status = "running"
        if done:
            run_status = "complete"
            if coverage["failed"] == len(states):
                run_status = "failed"
            elif coverage["failed"] or coverage["partial"]:
                run_status = "partial"
        run.update(
            extras={**run.extras, "status": run_status, "coverage": coverage},
            date_completed=timezone.now() if done else None,
        )


@instrumented_task(
    name="sentry.tasks.seer.monitor_cleanup.scan_project",
    namespace=seer_tasks,
    processing_deadline_duration=120,
)
def scan_project(shard_id: int) -> None:
    shard = (
        SeerNightShiftRunShard.objects.select_related("run__organization")
        .filter(id=shard_id)
        .first()
    )
    if shard is None or shard.seer_run_id is not None or shard.extras.get("status") in TERMINAL:
        return
    run = shard.run
    try:
        user = user_service.get_user(user_id=run.extras["triggering_user_id"])
        project = Project.objects.get(
            id=shard.extras["project_id"], organization_id=run.organization_id
        )
        if not user or not access.from_user(user, run.organization).has_project_access(project):
            raise ValueError("The triggering user no longer has access to this project.")
        if not features.has(FEATURE, run.organization, actor=user):
            raise ValueError("Monitor cleanup is not enabled for this organization.")

        def on_run_created(seer_run: SeerRun) -> None:
            shard.update(seer_run=seer_run, extras={**shard.extras, "status": "running"})

        with viewer_context_scope(
            ViewerContext(
                organization_id=run.organization_id,
                project_id=project.id,
                user_id=user.id,
                actor_type=ActorType.USER,
            )
        ):
            client = SeerAgentClient(
                organization=run.organization,
                user=user,
                project=project,
                category_key="workflow",
                category_value=SeerWorkflowStrategy.DUPLICATE_MONITORS,
                enable_code_mode_tools="only",
                code_mode_read_only=True,
                max_iterations=50,
                on_completion_hook=MonitorCleanupCompletionHook,
            )
            client.start_run(
                prompt=(
                    f"{MONITOR_CLEANUP_PROMPT}\n"
                    f"Organization: {run.organization.slug} (ID {run.organization_id}).\n"
                    f"Project: {project.slug} (ID {project.id})."
                ),
                artifact_key=ARTIFACT_KEY,
                artifact_schema=MonitorCleanupArtifact,
                metadata={"workflow_run_id": run.id, "project_id": project.id},
                force_ce=False,
                on_run_created=on_run_created,
            )
    except Exception:
        logger.exception("monitor_cleanup.dispatch_failed", extra={"shard_id": shard_id})
        finish_shard(
            shard_id, error="Could not start the scan. Check project access and Seer logs."
        )


def collect_monitor_cleanup_result(organization_id: int, seer_run_id: int) -> None:
    shard = (
        SeerNightShiftRunShard.objects.select_related("run__organization", "seer_run")
        .filter(
            run__organization_id=organization_id,
            run__workflow_config__strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS,
            seer_run__seer_run_state_id=seer_run_id,
        )
        .first()
    )
    if shard is None or shard.extras.get("status") in TERMINAL:
        return
    client = SeerAgentClient(organization=shard.run.organization)
    state = client.get_run(seer_run_id)
    if state.status == "processing":
        return
    if state.status != "completed":
        finish_shard(shard.id, error="Seer could not complete this scan.")
        return
    try:
        artifact = state.get_artifact(ARTIFACT_KEY, MonitorCleanupArtifact)
        if artifact is None:
            raise ValueError("Seer completed without structured monitor findings.")
        output = validate_monitor_cleanup(artifact, organization_id, shard.extras["project_id"])
        output["projectSlug"] = shard.extras["project_slug"]
    except ValueError:
        logger.exception("monitor_cleanup.invalid_output", extra={"shard_id": shard.id})
        finish_shard(shard.id, error="Seer returned findings that could not be validated.")
        return
    finish_shard(shard.id, output=output)


@instrumented_task(
    name="sentry.tasks.seer.monitor_cleanup.reconcile_run",
    namespace=seer_tasks,
    processing_deadline_duration=120,
)
def reconcile_run(run_id: int) -> None:
    run = SeerNightShiftRun.objects.filter(id=run_id).first()
    if run is None or run.date_completed is not None:
        return
    # Keep polling even if this task reaches its deadline while fetching Seer results.
    reconcile_run.apply_async(args=[run.id], countdown=120)
    for shard in run.shards.select_related("seer_run"):
        if shard.extras.get("status") in TERMINAL:
            continue
        if timezone.now() - run.date_added > RUN_TIMEOUT:
            finish_shard(shard.id, error="The scan timed out. Start a new run to try again.")
            continue
        if shard.seer_run and shard.seer_run.mirror_status == SeerRunMirrorStatus.FAILED:
            finish_shard(shard.id, error="The Seer request failed to start.")
            continue
        if shard.seer_run and shard.seer_run.seer_run_state_id is not None:
            try:
                collect_monitor_cleanup_result(
                    run.organization_id, shard.seer_run.seer_run_state_id
                )
            except Exception:
                logger.exception("monitor_cleanup.collect_failed", extra={"shard_id": shard.id})


def dispatch_run(run_id: int) -> None:
    run = SeerNightShiftRun.objects.filter(id=run_id).first()
    if run is None or run.date_completed is not None:
        return
    for shard in run.shards.all():
        try:
            scan_project.apply_async(args=[shard.id])
        except Exception:
            logger.exception("monitor_cleanup.enqueue_failed", extra={"shard_id": shard.id})
            finish_shard(shard.id, error="Could not queue this project scan.")
    reconcile_run.apply_async(args=[run.id], countdown=30)
