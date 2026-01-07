from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.autofix.autofix_agent import (
    AutofixStep,
    trigger_autofix_explorer,
    trigger_coding_agent_handoff,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint, get_project_seer_preferences
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.client_utils import fetch_run_status
from sentry.seer.explorer.on_completion_hook import ExplorerOnCompletionHook
from sentry.seer.models import (
    SeerApiError,
    SeerApiResponseValidationError,
    SeerAutomationHandoffConfiguration,
)
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.sentry_apps.utils.webhooks import SeerActionType

if TYPE_CHECKING:
    from sentry.seer.explorer.client_models import Artifact, SeerRunState

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

        # Get artifacts from the run
        artifacts = state.get_artifacts()

        # Send webhook for the completed step
        cls._send_step_webhook(organization, run_id, artifacts, state)

        # Continue the automated pipeline if stopping_point hasn't been reached
        cls._maybe_continue_pipeline(organization, run_id, state, artifacts)

    @classmethod
    def _send_step_webhook(
        cls, organization, run_id, artifacts: dict[str, Artifact], state: SeerRunState
    ):
        """
        Send webhook for the completed step.

        Determines which step just completed based on artifacts and sends
        the appropriate webhook event.
        """
        # Determine which artifact was just created and send appropriate webhook
        # We check in reverse priority order (most recent step first)
        webhook_payload = {"run_id": run_id}

        # Iterate through blocks in reverse order (most recent first)
        # to find which step just completed
        webhook_action_type: SeerActionType | None = None
        for block in reversed(state.blocks):
            # Check for code changes
            if block.file_patches:
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
                break

            # Check for artifacts
            if block.artifacts:
                artifact_map = {artifact.key: artifact for artifact in block.artifacts}

                if "solution" in artifact_map and artifact_map["solution"].data:
                    webhook_action_type = SeerActionType.SOLUTION_COMPLETED
                    webhook_payload["solution"] = artifact_map["solution"].data
                    break
                elif "root_cause" in artifact_map and artifact_map["root_cause"].data:
                    webhook_action_type = SeerActionType.ROOT_CAUSE_COMPLETED
                    webhook_payload["root_cause"] = artifact_map["root_cause"].data
                    break
                elif "impact_assessment" in artifact_map and artifact_map["impact_assessment"].data:
                    webhook_action_type = SeerActionType.IMPACT_ASSESSMENT_COMPLETED
                    webhook_payload["impact_assessment"] = artifact_map["impact_assessment"].data
                    break
                elif "triage" in artifact_map and artifact_map["triage"].data:
                    webhook_action_type = SeerActionType.TRIAGE_COMPLETED
                    webhook_payload["triage"] = artifact_map["triage"].data
                    break

        if webhook_action_type:
            try:
                broadcast_webhooks_for_organization.delay(
                    resource_name="seer",
                    event_name=webhook_action_type.value,
                    organization_id=organization.id,
                    payload=webhook_payload,
                )
            except Exception:
                logger.exception(
                    "autofix.on_completion_hook.webhook_failed",
                    extra={
                        "run_id": run_id,
                        "organization_id": organization.id,
                        "webhook_event": webhook_action_type.value,
                    },
                )

    @classmethod
    def _get_current_step(
        cls, artifacts: dict[str, Artifact], state: SeerRunState
    ) -> AutofixStep | None:
        """Determine which step just completed based on artifacts and state."""
        # Check in pipeline order (reverse) to find the most recent completed step
        if state.has_code_changes()[0]:
            return AutofixStep.CODE_CHANGES
        if "solution" in artifacts and artifacts["solution"].data:
            return AutofixStep.SOLUTION
        if "root_cause" in artifacts and artifacts["root_cause"].data:
            return AutofixStep.ROOT_CAUSE
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
        artifacts: dict[str, Artifact],
    ) -> None:
        """
        Continue to the next step if stopping_point hasn't been reached.

        Args:
            organization: The organization context
            run_id: The run ID
            state: The current run state
            artifacts: The artifacts from the run
        """
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

        # Determine current step from artifacts
        current_step = cls._get_current_step(artifacts, state)
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
        if not preference_response.preference:
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
