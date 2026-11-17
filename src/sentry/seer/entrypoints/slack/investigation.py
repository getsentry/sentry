from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

from sentry import features
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.utils.metrics import EventLifecycle
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.investigations.models.orchestration import InvestigationOrchestrationStatus
from sentry.locks import locks
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook
from sentry.notebooks.models.notebook import NotebookSourceType
from sentry.notifications.models.notificationthread import (
    NotificationThread,
    NotificationThreadObjectType,
)
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.seer import (
    SeerInvestigationError,
    SeerInvestigationStarted,
    SeerInvestigationStatus,
    SeerInvestigationStatusTemplate,
)
from sentry.notifications.platform.threading import ThreadingConfig, ThreadingService
from sentry.notifications.platform.tracking import (
    NotificationLink,
    NotificationTrackingContext,
    record_sent,
)
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationSource,
)
from sentry.seer.entrypoints.cache import SeerOperatorInvestigationCache
from sentry.seer.entrypoints.metrics import (
    SlackEntrypointEventLifecycleMetric,
    SlackEntrypointInteractionType,
)
from sentry.seer.entrypoints.slack.investigation_status import (
    build_investigation_conclusion,
    build_investigation_status,
)
from sentry.seer.entrypoints.slack.messaging import (
    send_thread_update,
    update_investigation_alert_message,
)
from sentry.seer.entrypoints.slack.types import SlackThreadDetails
from sentry.seer.entrypoints.types import SeerEntrypointKey, SeerInvestigationEntrypoint
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError
from sentry.utils.locking import UnableToAcquireLock

if TYPE_CHECKING:
    from sentry.integrations.slack.integration import SlackIntegration
    from sentry.integrations.slack.requests.action import SlackActionRequest


class SlackInvestigationCachePayload(TypedDict):
    organization_id: int
    integration_id: int
    channel_id: str
    thread_ts: str
    alert_message_ts: str
    slack_user_id: str


class SlackInvestigationThreadState(TypedDict, total=False):
    """What the investigation sent in a Slack thread, kept in its NotificationThread's provider_data."""

    status_message_ts: str | None
    last_sent_state: str | None
    final_sent: bool


class SlackInvestigationEntrypoint(
    SeerInvestigationEntrypoint[SlackInvestigationCachePayload],
):
    key = SeerEntrypointKey.SLACK

    def __init__(
        self,
        *,
        slack_request: SlackActionRequest,
        organization: Organization,
        channel_id: str,
        message_ts: str,
        slack_user_id: str,
    ):
        from sentry.integrations.slack.integration import SlackIntegration

        self.slack_request = slack_request
        self.organization = organization
        self.channel_id = channel_id
        self.message_ts = message_ts
        self.thread_ts: str = slack_request.data.get("message", {}).get("thread_ts") or message_ts
        self.slack_user_id = slack_user_id
        self.install = SlackIntegration(
            model=slack_request.integration, organization_id=organization.id
        )

    @staticmethod
    def has_access(organization: Organization) -> bool:
        return features.has("organizations:investigations-slack", organization)

    def _send_thread_update(
        self, data: NotificationData, ephemeral_user_id: str | None = None
    ) -> None:
        try:
            send_thread_update(
                install=self.install,
                thread=SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id),
                data=data,
                ephemeral_user_id=ephemeral_user_id,
            )
        except IntegrationError:
            # Already recorded by send_thread_update; it re-raises for task retries, which don't apply here.
            pass

    def on_trigger_investigation_error(self, *, error: str) -> None:
        self._send_thread_update(
            SeerInvestigationError(organization_id=self.organization.id, error_message=error),
            ephemeral_user_id=self.slack_user_id,
        )

    def on_trigger_investigation_success(self, *, investigation: Notebook) -> None:
        data = SeerInvestigationStarted(
            organization_id=self.organization.id,
            slack_user_id=self.slack_user_id,
            investigation_url=investigation.get_absolute_url(),
        )
        update_investigation_alert_message(
            request=self.slack_request,
            install=self.install,
            channel_id=self.channel_id,
            message_ts=self.message_ts,
            data=data,
        )
        self._send_thread_update(data)

    def create_investigation_cache_payload(self) -> SlackInvestigationCachePayload:
        return SlackInvestigationCachePayload(
            organization_id=self.organization.id,
            integration_id=self.install.model.id,
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            alert_message_ts=self.message_ts,
            slack_user_id=self.slack_user_id,
        )

    @staticmethod
    def on_investigation_update(
        cache_payload: SlackInvestigationCachePayload | None, run: InvestigationOrchestrationRun
    ) -> None:
        investigation_id = run.investigation_id
        lock = locks.get(
            f"seer:investigation:slack:{investigation_id}",
            duration=10,
            name="investigation_entrypoint_slack",
        )
        with SlackEntrypointEventLifecycleMetric(
            interaction_type=SlackEntrypointInteractionType.UPDATE_INVESTIGATION_STATUS,
            integration_id=cache_payload["integration_id"] if cache_payload else None,
            organization_id=run.investigation.organization_id,
        ).capture() as lifecycle:
            lifecycle.add_extras({"investigation_id": investigation_id})
            try:
                with lock.blocking_acquire(initial_delay=0.1, timeout=10):
                    if cache_payload is not None:
                        SlackInvestigationEntrypoint._update_investigation_status(
                            cache_payload=cache_payload, run_id=run.id, lifecycle=lifecycle
                        )
                    SlackInvestigationEntrypoint._send_conclusion_to_alert_threads(run_id=run.id)
            except UnableToAcquireLock as e:
                lifecycle.record_halt(halt_reason=e)
                # The holder may have read an older run, so retry once it lets go.
                raise

    @staticmethod
    def _update_investigation_status(
        *, cache_payload: SlackInvestigationCachePayload, run_id: int, lifecycle: EventLifecycle
    ) -> None:
        try:
            run = InvestigationOrchestrationRun.objects.select_related("investigation").get(
                id=run_id
            )
        except InvestigationOrchestrationRun.DoesNotExist:
            lifecycle.record_halt(halt_reason="run_not_found")
            return
        thread = _get_investigation_thread(
            investigation_id=run.investigation_id,
            integration_id=cache_payload["integration_id"],
            channel_id=cache_payload["channel_id"],
            thread_ts=cache_payload["thread_ts"],
        )
        state: SlackInvestigationThreadState = thread.provider_data

        data, fingerprint = build_investigation_status(
            investigation=run.investigation,
            projection=run.projection,
            phase=run.phase,
            status=run.status,
            updated_at=run.date_updated,
        )
        send_conclusion = (
            run.status == InvestigationOrchestrationStatus.COMPLETED and not state.get("final_sent")
        )
        if fingerprint == state.get("last_sent_state") and not send_conclusion:
            return

        install = _get_install(
            integration_id=cache_payload["integration_id"],
            organization_id=cache_payload["organization_id"],
        )
        if install is None:
            lifecycle.record_halt(halt_reason="integration_not_found")
            return

        new_state = state
        if fingerprint != state.get("last_sent_state"):
            renderable, links = NotificationService.render_template(
                data=data,
                template=SeerInvestigationStatusTemplate(),
                provider=provider_registry.get(NotificationProviderKey.SLACK),
            )
            status_message_ts = state.get("status_message_ts")
            try:
                if status_message_ts:
                    install.update_message(
                        channel_id=cache_payload["channel_id"],
                        message_ts=status_message_ts,
                        renderable=renderable,
                    )
                else:
                    response = install.send_threaded_message(
                        channel_id=cache_payload["channel_id"],
                        renderable=renderable,
                        thread_ts=cache_payload["thread_ts"],
                    )
                    status_message_ts = response.get("ts") if response is not None else None
            except (IntegrationError, IntegrationConfigurationError) as e:
                lifecycle.record_halt(halt_reason=e)
            else:
                _record_status_sent(data=data, links=links)
                new_state = {
                    **new_state,
                    "status_message_ts": status_message_ts,
                    "last_sent_state": fingerprint,
                }

        if send_conclusion and SlackInvestigationEntrypoint._send_investigation_conclusion(
            run=run, install=install, cache_payload=cache_payload
        ):
            new_state = {**new_state, "final_sent": True}

        if new_state != state:
            thread.update(provider_data=new_state)
            # The cache is how updates find this thread, so keep it alive while the thread changes.
            SeerOperatorInvestigationCache[SlackInvestigationCachePayload].set(
                entrypoint_key=str(SlackInvestigationEntrypoint.key),
                investigation_id=run.investigation_id,
                cache_payload=cache_payload,
            )

    @staticmethod
    def _send_investigation_conclusion(
        *,
        run: InvestigationOrchestrationRun,
        install: SlackIntegration,
        cache_payload: SlackInvestigationCachePayload,
    ) -> bool:
        """Posts the report text in the thread. Returns False if Slack did not accept the message."""
        with SlackEntrypointEventLifecycleMetric(
            interaction_type=SlackEntrypointInteractionType.SEND_INVESTIGATION_CONCLUSION,
            integration_id=cache_payload["integration_id"],
            organization_id=cache_payload["organization_id"],
        ).capture() as lifecycle:
            lifecycle.add_extras({"investigation_id": run.investigation_id})
            data = build_investigation_conclusion(run)
            if data is None:
                return True
            return _post_conclusion(
                install=install,
                thread=SlackThreadDetails(
                    thread_ts=cache_payload["thread_ts"], channel_id=cache_payload["channel_id"]
                ),
                data=data,
                lifecycle=lifecycle,
            )

    @staticmethod
    def _send_conclusion_to_alert_threads(*, run_id: int) -> None:
        """
        Posts the conclusion of a completed metric open period run in each Slack alert thread
        that doesn't have it yet.
        """
        try:
            run = InvestigationOrchestrationRun.objects.select_related("investigation").get(
                id=run_id
            )
        except InvestigationOrchestrationRun.DoesNotExist:
            return
        if run.status != InvestigationOrchestrationStatus.COMPLETED:
            return
        organization_id = run.investigation.organization_id
        open_period = _get_metric_open_period(run.investigation)
        if open_period is None:
            return

        threads = _get_alert_threads(open_period)
        data = build_investigation_conclusion(run)
        if not threads or data is None:
            return

        installs: dict[int, SlackIntegration | None] = {}
        for thread in threads:
            integration_id = thread.integration_id
            if integration_id is None:
                continue
            investigation_thread = _get_investigation_thread(
                investigation_id=run.investigation_id,
                integration_id=integration_id,
                channel_id=thread.target_id,
                thread_ts=thread.thread_identifier,
            )
            state: SlackInvestigationThreadState = investigation_thread.provider_data
            if state.get("final_sent"):
                continue
            with SlackEntrypointEventLifecycleMetric(
                interaction_type=SlackEntrypointInteractionType.SEND_INVESTIGATION_CONCLUSION,
                integration_id=integration_id,
                organization_id=organization_id,
            ).capture() as lifecycle:
                lifecycle.add_extras(
                    {"investigation_id": run.investigation_id, "notification_thread_id": thread.id}
                )
                if integration_id not in installs:
                    installs[integration_id] = _get_install(
                        integration_id=integration_id, organization_id=organization_id
                    )
                install = installs[integration_id]
                if install is None:
                    lifecycle.record_halt(halt_reason="integration_not_found")
                    continue
                if _post_conclusion(
                    install=install,
                    thread=SlackThreadDetails(
                        thread_ts=thread.thread_identifier, channel_id=thread.target_id
                    ),
                    data=data,
                    lifecycle=lifecycle,
                ):
                    investigation_thread.update(provider_data={**state, "final_sent": True})


def _get_metric_open_period(investigation: Notebook) -> GroupOpenPeriod | None:
    if investigation.source_type != NotebookSourceType.METRIC_OPEN_PERIOD:
        return None
    try:
        source_ref = investigation.source["ref"]
        group_id = int(source_ref["groupId"])
        open_period_id = int(source_ref["openPeriodId"])
    except (KeyError, TypeError, ValueError):
        return None
    try:
        return GroupOpenPeriod.objects.get(
            id=open_period_id,
            group_id=group_id,
            project__organization_id=investigation.organization_id,
        )
    except GroupOpenPeriod.DoesNotExist:
        return None


def _get_alert_threads(open_period: GroupOpenPeriod) -> list[NotificationThread]:
    """Returns the Slack metric alert threads belonging to the group and open period."""
    return [
        thread
        for thread in ThreadingService.get_threads_for_object(
            object_type=NotificationThreadObjectType.GROUP, object_id=open_period.group_id
        )
        if thread.provider_key
        in (NotificationProviderKey.SLACK, NotificationProviderKey.SLACK_STAGING)
        and thread.key_type == NotificationSource.METRIC_ALERT
        and thread.key_data.get("open_period_start") == open_period.date_started.isoformat()
    ]


def _get_investigation_thread(
    *, investigation_id: int, integration_id: int, channel_id: str, thread_ts: str
) -> NotificationThread:
    """Returns the investigation's thread for a Slack thread, creating it if needed."""
    return ThreadingService.get_or_create_thread(
        threading_config=ThreadingConfig(
            key_type=NotificationSource.SEER_INVESTIGATION_CONCLUSION,
            key_data={
                "investigation_id": investigation_id,
                "integration_id": integration_id,
                "thread_ts": thread_ts,
            },
            provider_key=NotificationProviderKey.SLACK,
            target_id=channel_id,
            thread_identifier=thread_ts,
            provider_data=None,
            object_type=NotificationThreadObjectType.INVESTIGATION,
            object_id=investigation_id,
            integration_id=integration_id,
        )
    )


def _get_install(*, integration_id: int, organization_id: int) -> SlackIntegration | None:
    from sentry.integrations.slack.integration import SlackIntegration

    active = integration_service.organization_context(
        integration_id=integration_id, organization_id=organization_id
    ).active()
    if active is None:
        return None
    integration, _ = active
    return SlackIntegration(model=integration, organization_id=organization_id)


def _post_conclusion(
    *,
    install: SlackIntegration,
    thread: SlackThreadDetails,
    data: NotificationData,
    lifecycle: EventLifecycle,
) -> bool:
    try:
        message_ts = send_thread_update(install=install, thread=thread, data=data)
    except IntegrationError as e:
        lifecycle.record_halt(halt_reason=e)
        return False
    if message_ts is None:
        lifecycle.record_halt(halt_reason="conclusion_not_sent")
        return False
    return True


def _record_status_sent(*, data: SeerInvestigationStatus, links: set[NotificationLink]) -> None:
    record_sent(
        NotificationTrackingContext(
            source=data.source,
            provider=NotificationProviderKey.SLACK,
            category=SeerInvestigationStatusTemplate.category,
            notification_uuid=data.notification_uuid,
            organization_id=data.organization_id,
        ),
        links=links,
    )
