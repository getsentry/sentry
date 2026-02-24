from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sentry import features
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.autofix.autofix_agent import (
    AutofixStep,
    trigger_autofix_explorer,
    trigger_coding_agent_handoff,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint, get_project_seer_preferences
from sentry.seer.entrypoints.operator import SeerOperator, process_autofix_updates
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.client_models import Artifact
from sentry.seer.explorer.client_utils import fetch_run_status
from sentry.seer.explorer.on_completion_hook import ExplorerOnCompletionHook
from sentry.seer.models import (
    SeerApiError,
    SeerApiResponseValidationError,
    SeerAutomationHandoffConfiguration,
)
from sentry.seer.supergroups import trigger_supergroups_embedding
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.seer.explorer.client_models import SeerRunState

logger = logging.getLogger(__name__)

# Pipeline order: which step follows which
PIPELINE_ORDER: list[AutofixStep] = [
    AutofixStep.ROOT_CAUSE,
    AutofixStep.SOLUTION,
    AutofixStep.CODE_CHANGES,
]

# Map stopping points to the step they represent
STOPPING_POINT_TO_STEP: dict[AutofixStoppingPoint, AutofixStep] = {
    AutofixStoppingPoint.ROOT_CAUSE: AutofixStep.ROOT_CAUSE,
    AutofixStoppingPoint.SOLUTION: AutofixStep.SOLUTION,
    AutofixStoppingPoint.CODE_CHANGES: AutofixStep.CODE_CHANGES,
}


class AutofixOnCompletionHook(ExplorerOnCompletionHook):
    """
    Hook called when an Explorer-based autofix run completes.

    Handles:
    - Sending webhooks for completed steps (root_cause_completed, solution_completed, etc.)
    - Continuing the automated pipeline if stopping_point hasn't been reached
    """

    @classmethod
    def execute(cls, organization: Organization, run_id: int) -> None:
        """
        Execute the hook when the Explorer agent completes a step.

        Args:
            organization: The organization context
            run_id: The ID of the completed run
        """
        try:
            state = fetch_run_status(run_id, organization)
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.fetch_state_failed",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        # Send webhook for the completed step
        cls._send_step_webhook(organization, run_id, state)

        cls._maybe_trigger_supergroups_embedding(organization, run_id, state)

        # Continue the automated pipeline if stopping_point hasn't been reached
        cls._maybe_continue_pipeline(organization, run_id, state)

    @classmethod
    def find_latest_artifact_for_step(cls, state: SeerRunState, key: str) -> Artifact | None:
        for block in reversed(state.blocks):
            if not block.artifacts:
                continue
            for artifact in reversed(block.artifacts):
                if key == artifact.key:
                    return artifact
        return None

    @classmethod
    def _send_step_webhook(cls, organization, run_id, state: SeerRunState):
        """
        Send webhook for the completed step.

        Determines which step just completed and sends the appropriate webhook event.
        """
        current_step = cls._get_current_step(state)

        webhook_payload = {"run_id": run_id}

        group_id = state.metadata.get("group_id") if state.metadata else None
        if group_id is not None:
            webhook_payload["group_id"] = group_id

        # Iterate through blocks in reverse order (most recent first)
        # to find which step just completed
        webhook_action_type: SeerActionType | None = None

        if current_step is not None:
            artifact = cls.find_latest_artifact_for_step(state, current_step)
            if artifact is not None:
                webhook_payload[current_step.value] = artifact.data

        if current_step == AutofixStep.ROOT_CAUSE:
            webhook_action_type = SeerActionType.ROOT_CAUSE_COMPLETED
        elif current_step == AutofixStep.SOLUTION:
            webhook_action_type = SeerActionType.SOLUTION_COMPLETED
        elif current_step == AutofixStep.CODE_CHANGES:
            webhook_action_type = SeerActionType.CODING_COMPLETED
            diffs_by_repo = state.get_diffs_by_repo()
            webhook_payload["code_changes"] = {
                repo: [
                    {
                        "path": p.patch.path,
                        "type": p.patch.type,
                        "added": p.patch.added,
                        "removed": p.patch.removed,
                    }
                    for p in patches
                ]
                for repo, patches in diffs_by_repo.items()
            }
        elif current_step == AutofixStep.IMPACT_ASSESSMENT:
            webhook_action_type = SeerActionType.IMPACT_ASSESSMENT_COMPLETED
        elif current_step == AutofixStep.TRIAGE:
            webhook_action_type = SeerActionType.TRIAGE_COMPLETED

        if not webhook_action_type:
            return

        event_name = webhook_action_type.value

        event_type = f"seer.{event_name}"
        try:
            sentry_app_event_type = SentryAppEventType(event_type)
            if SeerOperator.has_access(organization=organization):
                metrics.incr(
                    "autofix.on_completion_hook.process_autofix_updates",
                    tags={"event_type": str(event_type)},
                )
                process_autofix_updates.apply_async(
                    kwargs={
                        "event_type": sentry_app_event_type,
                        "event_payload": webhook_payload,
                        "organization_id": organization.id,
                    }
                )
        except ValueError:
            logger.exception(
                "autofix.on_completion_hook.webhook_invalid_event_type",
                extra={"event_type": event_type},
            )

        try:
            broadcast_webhooks_for_organization.delay(
                resource_name="seer",
                event_name=event_name,
                organization_id=organization.id,
                payload=webhook_payload,
            )
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.webhook_failed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "webhook_event": event_name,
                },
            )

    @classmethod
    def _maybe_trigger_supergroups_embedding(
        cls,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
    ) -> None:
        """Trigger supergroups embedding if feature flag is enabled."""
        current_step = cls._get_current_step(state)
        if current_step != AutofixStep.ROOT_CAUSE:
            return

        group_id = state.metadata.get("group_id") if state.metadata else None
        if group_id is None:
            return

        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            logger.warning(
                "autofix.supergroup_embedding.group_not_found",
                extra={"group_id": group_id},
            )
            return

        if not features.has("projects:supergroup-embeddings-explorer", group.project):
            return

        root_cause_artifact = cls.find_latest_artifact_for_step(state, AutofixStep.ROOT_CAUSE)
        if not root_cause_artifact or not root_cause_artifact.data:
            return

        try:
            trigger_supergroups_embedding(
                organization_id=organization.id,
                group_id=group_id,
                artifact_data=root_cause_artifact.data,
            )
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.supergroups_embedding_failed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "group_id": group_id,
                },
            )

    @classmethod
    def _get_current_step(cls, state: SeerRunState) -> AutofixStep | None:
        """Determine which step just completed."""
        for block in reversed(state.blocks):
            message = block.message
            if message.metadata is not None:
                # find the first message with a valid step metadata
                step = message.metadata.get("step")
                if step is not None:
                    try:
                        return AutofixStep(step)
                    except ValueError:
                        continue

        return None

    @classmethod
    def _get_next_step(cls, current_step: AutofixStep) -> AutofixStep | None:
        """Get the next step in the pipeline after the current step."""
        try:
            current_index = PIPELINE_ORDER.index(current_step)
            if current_index < len(PIPELINE_ORDER) - 1:
                return PIPELINE_ORDER[current_index + 1]
        except ValueError:
            pass
        return None

    @classmethod
    def _maybe_continue_pipeline(
        cls,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
    ) -> None:
        """
        Continue to the next step if stopping_point hasn't been reached.

        Args:
            organization: The organization context
            run_id: The run ID
            state: The current run state
        """
        current_step = cls._get_current_step(state)

        # Get pipeline metadata from state
        metadata = state.metadata
        if not metadata or "stopping_point" not in metadata:
            # No stopping point means manual mode - don't auto-continue
            return

        stopping_point = AutofixStoppingPoint(metadata["stopping_point"])
        group_id = metadata.get("group_id")

        if not group_id:
            logger.warning(
                "autofix.on_completion_hook.no_group_id_in_metadata",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        if current_step is None:
            logger.warning(
                "autofix.on_completion_hook.no_current_step",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        # Check if we've reached the stopping point
        stopping_step = STOPPING_POINT_TO_STEP.get(stopping_point)
        if stopping_step and current_step == stopping_step:
            # We've reached the stopping point
            return

        # Check if we should trigger coding agent handoff instead of continuing
        handoff_config = cls._get_handoff_config_if_applicable(
            stopping_point, current_step, group_id
        )
        if handoff_config:
            cls._trigger_coding_agent_handoff(organization, run_id, group_id, handoff_config)
            return

        # Special case: if stopping_point is open_pr and we just finished code_changes, push changes
        if (
            stopping_point == AutofixStoppingPoint.OPEN_PR
            and current_step == AutofixStep.CODE_CHANGES
        ):
            cls._push_changes(organization, run_id, state)
            return

        # Get the next step
        next_step = cls._get_next_step(current_step)
        if next_step is None:
            return

        # Stop if next step is code_changes and enable_seer_coding is False
        if next_step == AutofixStep.CODE_CHANGES and not organization.get_option(
            "sentry:enable_seer_coding", True
        ):
            logger.warning(
                "autofix.on_completion_hook.code_changes_step_disabled",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                },
            )
            return

        # Get the group
        try:
            group = Group.objects.get(id=group_id, project__organization=organization)
        except Group.DoesNotExist:
            logger.warning(
                "autofix.on_completion_hook.group_not_found",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "group_id": group_id,
                },
            )
            return

        # Trigger the next step
        logger.info(
            "autofix.on_completion_hook.continuing_pipeline",
            extra={
                "run_id": run_id,
                "organization_id": organization.id,
                "current_step": current_step,
                "next_step": next_step,
                "stopping_point": stopping_point,
            },
        )
        trigger_autofix_explorer(group=group, step=next_step, run_id=run_id)

    @classmethod
    def _push_changes(cls, organization: Organization, run_id: int, state: SeerRunState) -> None:
        """Push code changes to create PRs."""
        # Check if there are code changes to push
        has_changes, is_synced = state.has_code_changes()
        if not has_changes or is_synced:
            logger.info(
                "autofix.on_completion_hook.no_changes_to_push",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "has_changes": has_changes,
                    "is_synced": is_synced,
                },
            )
            return

        logger.info(
            "autofix.on_completion_hook.pushing_changes",
            extra={"run_id": run_id, "organization_id": organization.id},
        )

        try:
            client = SeerExplorerClient(organization=organization, user=None)
            client.push_changes(run_id)
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.push_changes_failed",
                extra={"run_id": run_id, "organization_id": organization.id},
            )

    @classmethod
    def _get_handoff_config_if_applicable(
        cls,
        stopping_point: AutofixStoppingPoint,
        current_step: AutofixStep | None,
        group_id: int,
    ) -> SeerAutomationHandoffConfiguration | None:
        """
        Read project preferences and return handoff config if applicable.

        Handoff is triggered when:
        - current_step is ROOT_CAUSE
        - stopping_point is SOLUTION, CODE_CHANGES, or OPEN_PR
        - automation_handoff is configured with handoff_point = ROOT_CAUSE
        """
        # Only trigger handoff after root cause is completed
        if current_step != AutofixStep.ROOT_CAUSE:
            return None

        # Only trigger handoff when continuing beyond root cause
        if stopping_point not in [
            AutofixStoppingPoint.SOLUTION,
            AutofixStoppingPoint.CODE_CHANGES,
            AutofixStoppingPoint.OPEN_PR,
        ]:
            return None

        # Check project preferences
        group = Group.objects.get(id=group_id)
        try:
            preference_response = get_project_seer_preferences(group.project_id)
        except (SeerApiError, SeerApiResponseValidationError):
            logger.exception(
                "autofix.on_completion_hook.get_preferences_failed",
                extra={"group_id": group_id, "project_id": group.project_id},
            )
            return None
        if not preference_response or not preference_response.preference:
            return None
        handoff_config = preference_response.preference.automation_handoff
        if not handoff_config:
            return None

        return handoff_config

    @classmethod
    def _trigger_coding_agent_handoff(
        cls,
        organization: Organization,
        run_id: int,
        group_id: int,
        handoff_config: SeerAutomationHandoffConfiguration,
    ) -> None:
        """Trigger coding agent handoff using the configured integration."""
        logger.info(
            "autofix.on_completion_hook.triggering_coding_agent_handoff",
            extra={
                "run_id": run_id,
                "organization_id": organization.id,
                "group_id": group_id,
                "integration_id": handoff_config.integration_id,
                "target": handoff_config.target,
            },
        )

        try:
            group = Group.objects.get(id=group_id)
            result = trigger_coding_agent_handoff(
                group=group,
                run_id=run_id,
                integration_id=handoff_config.integration_id,
            )
            logger.info(
                "autofix.on_completion_hook.coding_agent_handoff_completed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "successes": len(result.get("successes", [])),
                    "failures": len(result.get("failures", [])),
                },
            )
        except Group.DoesNotExist:
            logger.exception(
                "autofix.on_completion_hook.coding_agent_handoff_group_not_found",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "group_id": group_id,
                },
            )
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.coding_agent_handoff_failed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "integration_id": handoff_config.integration_id,
                },
            )
