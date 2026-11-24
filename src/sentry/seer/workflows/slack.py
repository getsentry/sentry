"""Deliver a configured automation run's Slack announcement."""

import logging

from taskbroker_client.retry import Retry

from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.slack.integration import SlackIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.locks import locks
from sentry.notifications.models.notificationthread import NotificationThreadObjectType
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.templates.seer import (
    SeerAutomationRunStarted,
    SeerAutomationRunStartedTemplate,
)
from sentry.notifications.platform.threading import ThreadingLookup, ThreadingService
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.seer.models.workflow import (
    SeerWorkflowRun,
    SeerWorkflowRunExtras,
    WorkflowSlackDestination,
)
from sentry.seer_workflow_outputs.models import SeerWorkflowOutputLink
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


class RetrySlackAnnouncement(Exception):
    """Slack explicitly rejected the request with a transient error."""


def _post_parent(run: SeerWorkflowRun, destination: WorkflowSlackDestination, name: str) -> bool:
    lookup = ThreadingLookup(
        key_type=NotificationSource.SEER_AUTOMATION_RUN_STARTED,
        key_data={"run_id": run.id, "integration_id": destination.integration_id},
        provider_key=NotificationProviderKey.SLACK,
        target_id=destination.channel_id,
    )
    if ThreadingService.resolve(threading_lookup=lookup):
        return True
    active = integration_service.organization_context(
        organization_id=run.organization_id, integration_id=destination.integration_id
    ).active()
    if active is None or active[0].provider != IntegrationProviderSlug.SLACK:
        logger.info("seer.workflow.slack.installation_unavailable", extra={"run_id": run.id})
        return False
    organization = run.organization
    data = SeerAutomationRunStarted(
        organization_id=organization.id,
        automation_name=name,
        runs_url=organization.absolute_url(
            f"/organizations/{organization.slug}/seer/automations/{run.workflow_config_id}/runs/"
        ),
    )
    renderable, _ = NotificationService.render_template(
        data=data,
        template=SeerAutomationRunStartedTemplate(),
        provider=provider_registry.get(NotificationProviderKey.SLACK),
    )
    target = IntegrationNotificationTarget(
        provider_key=NotificationProviderKey.SLACK,
        resource_type=NotificationTargetResourceType.CHANNEL,
        resource_id=destination.channel_id,
        integration_id=destination.integration_id,
        organization_id=organization.id,
    )
    installation = SlackIntegration(model=active[0], organization_id=organization.id)
    try:
        response = installation.send_notification(target, renderable)
    except IntegrationError as exc:
        if exc.error_code == 429 or exc.message in ("ratelimited", "internal_error"):
            raise RetrySlackAnnouncement from exc
        logger.warning(
            "seer.workflow.slack.send_failed",
            extra={"run_id": run.id, "error_code": exc.error_code},
            exc_info=True,
        )
        return False
    except OSError:
        # A lost response can mean Slack already created the parent.
        logger.exception("seer.workflow.slack.announcement_unconfirmed", extra={"run_id": run.id})
        return False
    ts = response.get("ts")
    if not ts:
        logger.warning("seer.workflow.slack.missing_timestamp", extra={"run_id": run.id})
        return False
    ThreadingService.store_new_thread(
        threading_config={
            **lookup,
            "thread_identifier": ts,
            "provider_data": None,
            "object_type": NotificationThreadObjectType.SEER_WORKFLOW_RUN,
            "object_id": run.id,
            "integration_id": destination.integration_id,
        },
        external_message_id=ts,
    )
    return True


@instrumented_task(
    name="sentry.seer.workflows.slack.announce_workflow_run",
    namespace=seer_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=4, delay=15, on=(UnableToAcquireLock, RetrySlackAnnouncement)),
    silo_mode=SiloMode.CELL,
)
def announce_workflow_run(*, organization_id: int, run_id: int) -> None:
    from sentry.seer.entrypoints.operator import process_investigation_updates

    run = SeerWorkflowRun.objects.select_related("organization").get_or_none(
        id=run_id, organization_id=organization_id
    )
    if run is None:
        return
    snapshot = SeerWorkflowRunExtras.parse_obj(run.extras).snapshot
    if snapshot.slack_destination is None:
        return
    with locks.get(
        f"seer:workflow:slack:{run.id}", duration=60, name="seer_workflow_slack"
    ).acquire():
        if not _post_parent(
            run, snapshot.slack_destination, snapshot.automation_name or "Seer automation"
        ):
            return
    investigations = (
        SeerWorkflowOutputLink.objects.filter(
            execution__run=run, notebook__organization_id=organization_id
        )
        .values_list("notebook_id", flat=True)
        .distinct()
    )
    for investigation_id in investigations:
        process_investigation_updates.delay(investigation_id=investigation_id)
