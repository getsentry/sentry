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
    retry=Retry(times=3),
)
def configure_seer_for_existing_org(organization_id: int) -> None:
    """
    Configure Seer settings for an existing organization migrating to new Seer pricing.

    Sets:
    - Org-level: enable_seer_coding=True - to override old check
    - Project-level (all projects): seer_scanner_automation=True, autofix_automation_tuning="medium"
    - Seer API (all projects): automated_run_stopping_point="code_changes"
    """
    organization = Organization.objects.get(id=organization_id)

    # Set org-level options
    organization.update_option("sentry:enable_seer_coding", True)

    projects = Project.objects.filter(organization_id=organization_id, status=0)

    successful_project_ids = []
    failed_project_ids = []
    skipped_project_ids = []

    # If seer is enabled for an org, every project must have project level settings
    for project in projects:
        # Set Sentry DB project options
        project.update_option("sentry:seer_scanner_automation", True)
        # For existing projects, if autofix is off we keep it off (user explicitly disabled it)
        current_tuning = project.get_option("sentry:autofix_automation_tuning")
        if current_tuning != "off":
            project.update_option("sentry:autofix_automation_tuning", "medium")

        try:
            # Get current Seer preferences
            get_body = orjson.dumps({"project_id": project.id})
            get_response = requests.post(
                f"{settings.SEER_AUTOFIX_URL}/v1/project-preference",
                data=get_body,
                headers={
                    "content-type": "application/json;charset=utf-8",
                    **sign_with_seer_secret(get_body),
                },
                timeout=5,
            )
            get_response.raise_for_status()
            current_prefs = get_response.json()

            # Check if stopping point is already set to open_pr or code_changes
            # For new projects, preference is None - use empty dict to safely access fields
            existing_pref = current_prefs.get("preference") or {}
            current_stopping_point = existing_pref.get("automated_run_stopping_point")

            if current_stopping_point in ("open_pr", "code_changes"):
                skipped_project_ids.append(project.id)
                continue

            # Preserve existing repositories and automation_handoff, only update stopping point
            set_body = orjson.dumps(
                {
                    "preference": {
                        "organization_id": organization_id,
                        "project_id": project.id,
                        "repositories": existing_pref.get("repositories") or [],
                        "automated_run_stopping_point": "code_changes",
                        "automation_handoff": existing_pref.get("automation_handoff"),
                    },
                }
            )

            set_response = requests.post(
                f"{settings.SEER_AUTOFIX_URL}/v1/project-preference/set",
                data=set_body,
                headers={
                    "content-type": "application/json;charset=utf-8",
                    **sign_with_seer_secret(set_body),
                },
                timeout=5,
            )
            set_response.raise_for_status()
            successful_project_ids.append(project.id)
        except (requests.RequestException, ValueError, AttributeError):
            logger.exception(
                "Failed to configure Seer preferences for project",
                extra={"organization_id": organization_id, "project_id": project.id},
            )
            failed_project_ids.append(project.id)

    attempted = len(successful_project_ids) + len(failed_project_ids)
    logger.info(
        "Configured Seer settings for existing org migrating to new pricing",
        extra={
            "organization_id": organization_id,
            "successful_rate": len(successful_project_ids) / attempted if attempted > 0 else 1.0,
            "successful_project_ids": successful_project_ids,
            "skipped_project_ids": skipped_project_ids,
            "failed_project_ids": failed_project_ids,
        },
    )
