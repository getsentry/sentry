import logging

import sentry_sdk
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from taskbroker_client.retry import Retry
from taskbroker_client.state import current_task

from sentry import analytics, features
from sentry.analytics.events.autofix_automation_events import AiAutofixAutomationEvent
from sentry.constants import (
    ObjectStatus,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.locks import locks
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.constants import (
    FIRST_ASSIGNMENT_SUMMARY_FEATURE,
    AutofixAutomationTuningSettings,
    SeerAutomationSource,
)
from sentry.seer.autofix.utils import (
    SEAT_BASED_STOPPING_POINTS,
    AutofixStoppingPoint,
    AutomationCodingAgent,
    SeerProjectSettingsUpdate,
    bulk_read_preferences_from_sentry_db,
    get_org_default_seer_automation_handoff,
    get_seer_seat_based_tier_cache_key,
    is_issue_category_eligible,
    update_seer_project_settings,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ingest_errors_tasks, issues_tasks
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

class FirstAssignmentSummaryRetry(Exception):
    """A transient condition prevented first-assignment summary generation."""


def _record_first_assignment_summary_result(outcome: str, reason: str) -> None:
    metrics.incr(
        "sentry.tasks.autofix.first_assignment_summary",
        sample_rate=1.0,
        tags={"outcome": outcome, "reason": reason},
    )


def _clear_free_autofix_cohort_configuration(organization: Organization) -> None:
    if not organization.get_option("agentic-triage-free-cohort", False):
        return

    SeerProjectRepository.objects.filter(
        project_repository__project__organization_id=organization.id
    ).delete()
    organization.delete_option("agentic-triage-free-cohort")


def _get_group_or_log(group_id: int, task_name: str) -> Group | None:
    """Fetch a Group by ID, returning None and logging a warning if it no longer exists."""
    try:
        return Group.objects.get(id=group_id)
    except Group.DoesNotExist:
        logger.warning("%s.group_not_found", task_name, extra={"group_id": group_id})
        return None


@instrumented_task(
    name="sentry.tasks.autofix.generate_summary_and_run_automation",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=1),
)
def generate_summary_and_run_automation(group_id: int, **kwargs) -> None:
    from sentry.seer.autofix.issue_summary import get_issue_summary, run_automation

    trigger_path = kwargs.get("trigger_path", "unknown")
    sentry_sdk.set_tag("trigger_path", trigger_path)
    sentry_sdk.set_attribute("trigger_path", trigger_path)

    group = _get_group_or_log(group_id, "generate_summary_and_run_automation")
    if group is None:
        return
    organization = group.project.organization

    task_state = current_task()
    if task_state is None or task_state.attempt == 0:
        metrics.incr("sentry.tasks.autofix.generate_summary_and_run_automation", sample_rate=1.0)
        analytics.record(
            AiAutofixAutomationEvent(
                organization_id=organization.id,
                project_id=group.project_id,
                group_id=group.id,
                task_name="generate_summary_and_run_automation",
                issue_event_count=group.times_seen,
                fixability_score=group.seer_fixability_score,
            )
        )

    _, status = get_issue_summary(
        group=group,
        source=SeerAutomationSource.POST_PROCESS,
        should_run_automation=False,
    )
    if status != 200:
        return

    # Automation is intentionally separate from summary generation. A summary
    # pre-warmed by another source must not suppress the post-process Autofix run.
    event = group.get_latest_event()
    if event is None:
        logger.warning(
            "generate_summary_and_run_automation.no_event_found",
            extra={"group_id": group_id},
        )
        return
    run_automation(
        group=group,
        user=AnonymousUser(),
        event=event,
        source=SeerAutomationSource.POST_PROCESS,
    )


@instrumented_task(
    name="sentry.tasks.autofix.generate_issue_summary_only",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=3, delay=3, on=(Exception,)),
)
def generate_issue_summary_only(group_id: int) -> None:
    """
    Generate issue summary WITHOUT triggering automation.
    Used for the triage signals flow when a summary doesn't exist yet.
    """
    from sentry.seer.autofix.issue_summary import (
        get_and_update_group_fixability_score,
        get_issue_summary,
    )

    group = _get_group_or_log(group_id, "generate_issue_summary_only")
    if group is None:
        return
    organization = group.project.organization

    task_state = current_task()
    if task_state is None or task_state.attempt == 0:
        metrics.incr("sentry.tasks.autofix.generate_issue_summary_only", sample_rate=1.0)
        analytics.record(
            AiAutofixAutomationEvent(
                organization_id=organization.id,
                project_id=group.project_id,
                group_id=group.id,
                task_name="generate_issue_summary_only",
                issue_event_count=group.times_seen,
                fixability_score=group.seer_fixability_score,
            )
        )

    # Generate and cache the summary
    get_issue_summary(
        group=group, source=SeerAutomationSource.POST_PROCESS, should_run_automation=False
    )

    get_and_update_group_fixability_score(group, force_generate=True)


def _get_assignment_entry(
    group_id: int, assignment_activity_id: int
) -> GroupActionLogEntry | None:
    from sentry.issues.action_log.types import GroupActionType

    entries = GroupActionLogEntry.objects.filter(
        group_id=group_id,
        type=GroupActionType.ASSIGN,
    )
    return entries.filter(idempotency_key=f"activity:{assignment_activity_id}").first()


def _get_first_assignment_action_id_when_ready(
    group_id: int, assignment_entry: GroupActionLogEntry
) -> int:
    from sentry.issues.derived.features import FIRST_ASSIGNMENT_ACTION_ID
    from sentry.issues.derived.processing import PIPELINE
    from sentry.issues.derived.store import GroupDerivedDataStore
    from sentry.issues.derived.tasks import generate_group_derived_data, process_group_log_task
    from sentry.issues.models.groupderiveddata import GroupDerivedData

    try:
        derived = GroupDerivedData.objects.get(group_id=group_id)
    except GroupDerivedData.DoesNotExist:
        generate_group_derived_data.delay(group_id)
        _record_first_assignment_summary_result("retry", "derived_missing")
        raise FirstAssignmentSummaryRetry("Derived data does not exist yet")

    if derived.pipeline_hash != PIPELINE.pipeline_hash:
        generate_group_derived_data.delay(group_id)
        _record_first_assignment_summary_result("retry", "derived_stale")
        raise FirstAssignmentSummaryRetry("Derived data uses a stale pipeline")

    if (derived.cursor_date, derived.cursor_id) < (
        assignment_entry.date_added,
        assignment_entry.id,
    ):
        process_group_log_task.delay(group_id, incremental=True)
        _record_first_assignment_summary_result("retry", "derived_behind")
        raise FirstAssignmentSummaryRetry("Derived data has not processed the assignment")

    state = GroupDerivedDataStore.load(PIPELINE, derived)
    first_assignment_action_id = state[FIRST_ASSIGNMENT_ACTION_ID]
    if first_assignment_action_id is None:
        generate_group_derived_data.delay(group_id)
        _record_first_assignment_summary_result("retry", "derived_inconsistent")
        raise FirstAssignmentSummaryRetry("First assignment is absent from derived data")
    return first_assignment_action_id


@instrumented_task(
    name="sentry.tasks.autofix.generate_first_assignment_summary",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=50,
    retry=Retry(
        times=10,
        delay=30,
        on=(FirstAssignmentSummaryRetry, UnableToAcquireLock),
    ),
)
def generate_first_assignment_summary(
    group_id: int,
    assignment_activity_id: int,
) -> None:
    """Generate summary-derived data only for an issue's first assignment."""
    from sentry.seer.autofix.issue_summary import (
        get_and_update_group_fixability_score,
        get_issue_summary,
    )

    group = _get_group_or_log(group_id, "generate_first_assignment_summary")
    if group is None:
        _record_first_assignment_summary_result("skipped", "group_missing")
        return

    organization = group.project.organization
    if not features.has(FIRST_ASSIGNMENT_SUMMARY_FEATURE, organization):
        _record_first_assignment_summary_result("skipped", "rollout_flag")
        return
    if not features.has("organizations:gen-ai-features", organization):
        _record_first_assignment_summary_result("skipped", "gen_ai_flag")
        return
    if organization.get_option("sentry:hide_ai_features"):
        _record_first_assignment_summary_result("skipped", "ai_hidden")
        return
    if not is_issue_category_eligible(group):
        _record_first_assignment_summary_result("skipped", "issue_category")
        return

    assignment_entry = _get_assignment_entry(group_id, assignment_activity_id)
    if assignment_entry is None:
        _record_first_assignment_summary_result("retry", "assignment_pending")
        raise FirstAssignmentSummaryRetry("Assignment is not in the action log yet")

    first_assignment_action_id = _get_first_assignment_action_id_when_ready(
        group_id, assignment_entry
    )
    if first_assignment_action_id != assignment_entry.id:
        _record_first_assignment_summary_result("skipped", "not_first_assignment")
        return

    lag_seconds = max(0.0, (timezone.now() - assignment_entry.date_added).total_seconds())
    metrics.distribution(
        "sentry.tasks.autofix.first_assignment_summary_lag",
        lag_seconds,
        unit="second",
    )

    lock = locks.get(
        key=f"first-assignment-summary:{group_id}",
        duration=60,
        name="generate_first_assignment_summary",
    )
    try:
        with lock.acquire():
            summary, status = get_issue_summary(
                group=group,
                source=SeerAutomationSource.FIRST_ASSIGNMENT,
                should_run_automation=False,
            )
            if status == 503:
                _record_first_assignment_summary_result("retry", "summary_lock")
                raise FirstAssignmentSummaryRetry("Issue summary lock timed out")
            if status == 400 and summary.get("detail") == "Could not find an event for the issue":
                _record_first_assignment_summary_result("retry", "event_missing")
                raise FirstAssignmentSummaryRetry("Issue event is not available yet")
            if status >= 500:
                _record_first_assignment_summary_result("retry", "summary_server_error")
                raise FirstAssignmentSummaryRetry(f"Issue summary failed with status {status}")
            if status != 200:
                _record_first_assignment_summary_result("skipped", "summary_rejected")
                return

            get_and_update_group_fixability_score(group, force_generate=False)
    except FirstAssignmentSummaryRetry:
        raise
    except UnableToAcquireLock:
        _record_first_assignment_summary_result("retry", "orchestration_lock")
        raise
    except Exception as error:
        logger.exception(
            "generate_first_assignment_summary.failed",
            extra={
                "group_id": group_id,
                "assignment_action_id": assignment_entry.id,
            },
        )
        _record_first_assignment_summary_result("retry", "seer_error")
        raise FirstAssignmentSummaryRetry("Seer processing failed") from error

    _record_first_assignment_summary_result("completed", "success")


@instrumented_task(
    name="sentry.tasks.autofix.run_automation_only_task",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=1),
)
def run_automation_only_task(group_id: int) -> None:
    """
    Run automation directly for a group (assumes summary and fixability already exist).
    Used for the triage signals flow when a summary already exists.
    """
    from django.contrib.auth.models import AnonymousUser

    from sentry.seer.autofix.issue_summary import run_automation

    group = _get_group_or_log(group_id, "run_automation_only_task")
    if group is None:
        return
    organization = group.project.organization

    task_state = current_task()
    if task_state is None or task_state.attempt == 0:
        metrics.incr("sentry.tasks.autofix.run_automation_only_task", sample_rate=1.0)
        analytics.record(
            AiAutofixAutomationEvent(
                organization_id=organization.id,
                project_id=group.project_id,
                group_id=group.id,
                task_name="run_automation_only",
                issue_event_count=group.times_seen,
                fixability_score=group.seer_fixability_score,
            )
        )

    event = group.get_latest_event()

    if not event:
        logger.warning("run_automation_only_task.no_event_found", extra={"group_id": group_id})
        return

    # Track issue age when running automation
    issue_age_days = int((timezone.now() - group.first_seen).total_seconds() / (60 * 60 * 24))

    metrics.distribution(
        "seer.automation.issue_age_since_first_seen", issue_age_days, unit="day", sample_rate=1.0
    )

    run_automation(
        group=group, user=AnonymousUser(), event=event, source=SeerAutomationSource.POST_PROCESS
    )


@instrumented_task(
    name="sentry.tasks.autofix.configure_seer_for_existing_org",
    namespace=issues_tasks,
    processing_deadline_duration=90,
    retry=Retry(times=3),
)
def configure_seer_for_existing_org(organization_id: int) -> None:
    """
    Configure Seer settings for a new or existing organization migrating to new Seer pricing.

    Sets:
    - Project-level (all projects): seer_scanner_automation=True, autofix_automation_tuning="medium" or "off"
    - Seer project preferences (all projects): automated_run_stopping_point="code_changes" or "open_pr",
      and automation_handoff backfilled from the org defaults (when set) for projects that don't already
      have one configured.

    Ignores:
    - Org-level: enable_seer_coding
    """

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "configure_seer_for_existing_org.organization_not_found",
            extra={"organization_id": organization_id},
        )
        return

    sentry_sdk.set_tag("organization_id", organization.id)
    sentry_sdk.set_attribute("organization_id", organization.id)
    sentry_sdk.set_tag("organization_slug", organization.slug)
    sentry_sdk.set_attribute("organization_slug", organization.slug)
    _clear_free_autofix_cohort_configuration(organization)

    # Set org-level options
    organization.update_option(
        "sentry:default_autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
    )

    projects = list(
        Project.objects.filter(organization_id=organization_id, status=ObjectStatus.ACTIVE)
    )
    project_ids = [p.id for p in projects]

    if len(project_ids) == 0:
        return

    # If seer is enabled for an org, every project must have project level settings
    for project in projects:
        project.update_option("sentry:seer_scanner_automation", True)
        autofix_automation_tuning = project.get_option("sentry:autofix_automation_tuning")
        if autofix_automation_tuning != AutofixAutomationTuningSettings.OFF:
            project.update_option(
                "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
            )

    default_stopping_point, default_handoff = get_org_default_seer_automation_handoff(organization)
    preferences = bulk_read_preferences_from_sentry_db(organization_id, project_ids)

    # Determine which projects need updates
    preferences_set = 0
    for project in projects:
        stopping_point = default_stopping_point
        handoff = default_handoff

        existing_pref = preferences.get(project.id)
        if existing_pref:
            existing_stopping_point = existing_pref.automated_run_stopping_point
            existing_handoff = existing_pref.automation_handoff

            # Skip projects that a) already have an acceptable stopping point configured
            # AND b) already have a handoff configured or no org default handoff.
            if existing_stopping_point in SEAT_BASED_STOPPING_POINTS and (
                existing_handoff or default_handoff is None
            ):
                continue

            if existing_stopping_point in SEAT_BASED_STOPPING_POINTS:
                stopping_point = existing_stopping_point
            if existing_handoff:
                handoff = existing_handoff

        update = SeerProjectSettingsUpdate(stopping_point=stopping_point)
        if handoff is not None:
            update["agent"] = AutomationCodingAgent(handoff.target)
            update["integration_id"] = handoff.integration_id
            update["auto_create_pr"] = handoff.auto_create_pr
        else:
            update["agent"] = AutomationCodingAgent.SEER
            update["auto_create_pr"] = stopping_point == AutofixStoppingPoint.OPEN_PR

        update_seer_project_settings([project.id], update)
        preferences_set += 1

    # Invalidate existing cache entry and set cache to True to prevent race conditions where another
    # request re-caches False before the billing flag has fully propagated
    cache.set(get_seer_seat_based_tier_cache_key(organization_id), True, timeout=60 * 5)

    logger.info(
        "Task: configure_seer_for_existing_org completed",
        extra={
            "org_id": organization.id,
            "org_slug": organization.slug,
            "projects_configured": len(project_ids),
            "preferences_set": preferences_set,
        },
    )
