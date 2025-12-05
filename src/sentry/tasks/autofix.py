import logging
from datetime import datetime, timedelta

import orjson
import requests
from django.conf import settings

from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.constants import AutofixStatus, SeerAutomationSource
from sentry.seer.autofix.utils import get_autofix_state
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ingest_errors_tasks, issues_tasks
from sentry.taskworker.retry import Retry

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
    retry=Retry(times=1),
)
def generate_issue_summary_only(group_id: int) -> None:
    """
    Generate issue summary WITHOUT triggering automation.
    Used for triage signals flow when event count < 10 or when summary doesn't exist yet.
    """
    from sentry.seer.autofix.issue_summary import (
        get_and_update_group_fixability_score,
        get_issue_summary,
    )

    group = Group.objects.get(id=group_id)
    logger.info("Task: generate_issue_summary_only, group_id=%s", group_id)
    get_issue_summary(
        group=group, source=SeerAutomationSource.POST_PROCESS, should_run_automation=False
    )

    _ = get_and_update_group_fixability_score(group, force_generate=True)


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
    logger.info("Task: run_automation_only_task, group_id=%s", group_id)

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

    # Set org-level options
    organization.update_option("sentry:enable_seer_coding", True)

    projects = list(Project.objects.filter(organization_id=organization_id, status=0))
    project_ids = [p.id for p in projects]

    # If seer is enabled for an org, every project must have project level settings
    for project in projects:
        project.update_option("sentry:seer_scanner_automation", True)
        # If autofix is "off" (the registered default for all projects), keep it off.
        # New projects and existing projects that have explicitly set it to "off" will keep it off.
        # Otherwise, normalize any other tuning value to "medium".
        if project.get_option("sentry:autofix_automation_tuning") != "off":
            project.update_option("sentry:autofix_automation_tuning", "medium")

    if not project_ids:
        return

    # Bulk GET all project preferences
    get_body = orjson.dumps({"organization_id": organization_id, "project_ids": project_ids})
    try:
        get_response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/project-preference/bulk",
            data=get_body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(get_body),
            },
            timeout=30,
        )
        get_response.raise_for_status()
        preferences_by_id = get_response.json().get("preferences", {})
    except requests.RequestException:
        logger.exception(
            "Failed to bulk get Seer preferences",
            extra={"organization_id": organization_id},
        )
        return

    # Determine which projects need updates
    preferences_to_set = []
    for project_id in project_ids:
        # preferences_by_id keys are strings from JSON
        existing_pref = preferences_by_id.get(str(project_id))
        if not isinstance(existing_pref, dict):
            existing_pref = {}

        # Skip projects that already have an acceptable stopping point configured
        if existing_pref.get("automated_run_stopping_point") in ("open_pr", "code_changes"):
            continue

        # Preserve existing repositories and automation_handoff (may be None for new
        # projects), only update the stopping point to enable code_changes automation.
        preferences_to_set.append(
            {
                "organization_id": organization_id,
                "project_id": project_id,
                "repositories": existing_pref.get("repositories") or [],
                "automated_run_stopping_point": "code_changes",
                "automation_handoff": existing_pref.get("automation_handoff"),
            }
        )

    # Bulk SET all project preferences that need updating
    if preferences_to_set:
        set_body = orjson.dumps(
            {"organization_id": organization_id, "preferences": preferences_to_set}
        )
        try:
            set_response = requests.post(
                f"{settings.SEER_AUTOFIX_URL}/v1/project-preference/bulk-set",
                data=set_body,
                headers={
                    "content-type": "application/json;charset=utf-8",
                    **sign_with_seer_secret(set_body),
                },
                timeout=30,
            )
            set_response.raise_for_status()
        except requests.RequestException:
            logger.exception(
                "Failed to bulk set Seer preferences",
                extra={"organization_id": organization_id},
            )
