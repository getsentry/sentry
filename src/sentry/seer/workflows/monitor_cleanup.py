from collections.abc import Sequence
from datetime import timedelta

from django.db import router, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, Throttled, ValidationError
from rest_framework.request import Request

from sentry import features
from sentry.incidents.grouptype import MetricIssue
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunShard
from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.seer.monitor_cleanup import FEATURE
from sentry.tasks.seer.monitor_cleanup import dispatch_run


def start_monitor_cleanup(
    request: Request, organization: Organization, accessible_projects: Sequence[Project]
) -> SeerNightShiftRun:
    if not features.has(FEATURE, organization, actor=request.user):
        raise NotFound
    if not request.user.is_authenticated:
        raise PermissionDenied("Sign in to run a monitor scan.")
    projects = list(
        Project.objects.filter(
            organization=organization,
            id__in=[project.id for project in accessible_projects],
            detector__type=MetricIssue.slug,
        )
        .distinct()
        .order_by("id")
    )
    if not projects:
        raise ValidationError({"detail": "No accessible projects have metric monitors."})
    if len(projects) > 20:
        raise ValidationError(
            {"detail": "This demo supports up to 20 projects with metric monitors."}
        )
    config = SeerWorkflowConfig.get_or_create_for_strategy(
        organization.id, SeerWorkflowStrategy.DUPLICATE_MONITORS
    )
    with transaction.atomic(router.db_for_write(SeerNightShiftRun)):
        config = SeerWorkflowConfig.objects.select_for_update().get(id=config.id)
        if SeerNightShiftRun.objects.filter(
            workflow_config=config, date_completed__isnull=True
        ).exists():
            raise ValidationError({"detail": "A monitor scan is already running."})
        if (
            SeerNightShiftRun.objects.filter(
                workflow_config=config, date_added__gte=timezone.now() - timedelta(hours=1)
            ).count()
            >= 5
        ):
            raise Throttled(
                detail="This organization has reached the limit of five scans per hour."
            )
        run = SeerNightShiftRun.objects.create(
            organization=organization,
            workflow_config=config,
            extras={
                "options": {"source": "manual"},
                "triggering_user_id": request.user.id,
                "target_project_ids": [p.id for p in projects],
                "status": "running",
            },
        )
        SeerNightShiftRunShard.objects.bulk_create(
            [
                SeerNightShiftRunShard(
                    run=run,
                    extras={"project_id": p.id, "project_slug": p.slug, "status": "queued"},
                )
                for p in projects
            ]
        )
        transaction.on_commit(
            lambda: dispatch_run(run.id), using=router.db_for_write(SeerNightShiftRun)
        )
    return run
