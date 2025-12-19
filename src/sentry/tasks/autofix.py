import logging
from datetime import datetime, timedelta

import sentry_sdk

from sentry.constants import ObjectStatus
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.constants import (
    AutofixAutomationTuningSettings,
    AutofixStatus,
    SeerAutomationSource,
)
from sentry.seer.autofix.utils import (
    bulk_get_project_preferences,
    bulk_set_project_preferences,
    get_autofix_repos_from_project_code_mappings,
    get_autofix_state,
    get_seer_seat_based_tier_cache_key,
)
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ingest_errors_tasks, issues_tasks
from sentry.taskworker.retry import Retry
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.autofix.check_autofix_status",
    namespace=issues_tasks,
    retry=Retry(times=1),
)
def check_autofix_status(run_id: int, organization_id: int) -> None:
    state = get_autofix_state(run_id=run_id, organization_id=organization_id)

    if (
        state
        and state.status == AutofixStatus.PROCESSING
        and state.updated_at < datetime.now() - timedelta(minutes=5)
    ):
        # This should log to sentry
        logger.error(
            "Autofix run has been processing for more than 5 minutes", extra={"run_id": run_id}
        )


@instrumented_task(
    name="sentry.tasks.autofix.generate_summary_and_run_automation",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=1),
)
def generate_summary_and_run_automation(group_id: int) -> None:
    from sentry.seer.autofix.issue_summary import get_issue_summary

    group = Group.objects.get(id=group_id)
    get_issue_summary(group=group, source=SeerAutomationSource.POST_PROCESS)


@instrumented_task(
    name="sentry.tasks.autofix.generate_issue_summary_only",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=3, delay=3, on=(Exception,)),
)
def generate_issue_summary_only(group_id: int) -> None:
    """
    Generate issue summary WITHOUT triggering automation.
    Used for triage signals flow when event count < 10 or when summary doesn't exist yet.
    """
    from sentry.api.serializers.rest_framework.base import (
        camel_to_snake_case,
        convert_dict_key_case,
    )
    from sentry.seer.autofix.issue_summary import (
        get_and_update_group_fixability_score,
        get_issue_summary,
    )
    from sentry.seer.models import FixabilitySummaryPayload

    group = Group.objects.get(id=group_id)
    organization = group.project.organization
    logger.info(
        "Task: generate_issue_summary_only",
        extra={"org_id": organization.id, "org_slug": organization.slug},
    )
    summary_data, status_code = get_issue_summary(
        group=group, source=SeerAutomationSource.POST_PROCESS, should_run_automation=False
    )

    summary_payload = None
    if status_code == 200:
        summary_snake = convert_dict_key_case(summary_data, camel_to_snake_case)
        summary_payload = FixabilitySummaryPayload(
            group_id=group.id,
            **{k: summary_snake[k] for k in ["headline", "whats_wrong", "trace", "possible_cause"]},
        )

    get_and_update_group_fixability_score(group, force_generate=True, summary=summary_payload)


@instrumented_task(
    name="sentry.tasks.autofix.run_automation_only_task",
    namespace=ingest_errors_tasks,
    processing_deadline_duration=35,
    retry=Retry(times=1),
)
def run_automation_only_task(group_id: int) -> None:
    """
    Run automation directly for a group (assumes summary and fixability already exist).
    Used for triage signals flow when event count >= 10 and summary exists.
    """
    from django.contrib.auth.models import AnonymousUser

    from sentry.seer.autofix.issue_summary import run_automation

    group = Group.objects.get(id=group_id)
    organization = group.project.organization
    logger.info(
        "Task: run_automation_only_task",
        extra={"org_id": organization.id, "org_slug": organization.slug},
    )

    event = group.get_latest_event()

    if not event:
        logger.warning("run_automation_only_task.no_event_found", extra={"group_id": group_id})
        return

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
    - Org-level: enable_seer_coding=True - to override old check
    - Project-level (all projects): seer_scanner_automation=True, autofix_automation_tuning="medium" or "off"
    - Seer API (all projects): automated_run_stopping_point="code_changes" or "open_pr"
    """
    organization = Organization.objects.get(id=organization_id)

    sentry_sdk.set_tag("organization_id", organization.id)
    sentry_sdk.set_tag("organization_slug", organization.slug)

    # Set org-level options
    organization.update_option("sentry:enable_seer_coding", True)
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
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )

    preferences_by_id = bulk_get_project_preferences(organization_id, project_ids)

    # Determine which projects need updates
    preferences_to_set = []
    projects_by_id = {p.id: p for p in projects}
    for project_id in project_ids:
        existing_pref = preferences_by_id.get(str(project_id))
        if not existing_pref:
            # No existing preferences, get repositories from code mappings
            repositories = get_autofix_repos_from_project_code_mappings(projects_by_id[project_id])
        else:
            # Skip projects that already have an acceptable stopping point configured
            if existing_pref.get("automated_run_stopping_point") in ("open_pr", "code_changes"):
                continue
            repositories = existing_pref.get("repositories") or []

        # Preserve existing repositories and automation_handoff, only update the stopping point
        preferences_to_set.append(
            {
                "organization_id": organization_id,
                "project_id": project_id,
                "repositories": repositories or [],
                "automated_run_stopping_point": "code_changes",
                "automation_handoff": (
                    existing_pref.get("automation_handoff") if existing_pref else None
                ),
            }
        )

    if len(preferences_to_set) > 0:
        bulk_set_project_preferences(organization_id, preferences_to_set)

    # Invalidate existing cache entry and set cache to True to prevent race conditions where another
    # request re-caches False before the billing flag has fully propagated
    cache.set(get_seer_seat_based_tier_cache_key(organization_id), True, timeout=60 * 5)

    logger.info(
        "Task: configure_seer_for_existing_org completed",
        extra={
            "org_id": organization.id,
            "org_slug": organization.slug,
            "projects_configured": len(project_ids),
            "preferences_set_via_api": len(preferences_to_set),
        },
    )
