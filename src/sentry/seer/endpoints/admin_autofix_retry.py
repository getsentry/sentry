import logging
from typing import Any

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import fetch_run_status
from sentry.seer.autofix.autofix_agent import trigger_autofix_agent
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.feature.models import FEATURE_ID, LEGACY_FEATURE_ID
from sentry.seer.autofix.on_completion_hook import PIPELINE_ORDER, AutofixOnCompletionHook
from sentry.seer.models import SeerRun
from sentry.viewer_context import ActorType, ViewerContext, viewer_context_scope

logger = logging.getLogger(__name__)

MAX_RUN_IDS = 50


class AdminAutofixRetrySerializer(serializers.Serializer):
    run_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1, max_length=MAX_RUN_IDS
    )


@internal_cell_silo_endpoint
class SeerAdminAutofixRetryEndpoint(Endpoint):
    """Re-run the failed step of errored (e.g. timed out) autofix runs."""

    owner = ApiOwner.ML_AI
    permission_classes = (StaffPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request) -> Response:
        serializer = AdminAutofixRetrySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        run_ids: list[int] = list(dict.fromkeys(serializer.validated_data["run_ids"]))
        organizations_by_run_id = {
            run.seer_run_state_id: run.organization
            for run in SeerRun.objects.filter(
                seer_run_state_id__in=run_ids,
                agent__source__in=(FEATURE_ID, LEGACY_FEATURE_ID),
            ).select_related("organization")
        }

        results = []
        for run_id in run_ids:
            organization = organizations_by_run_id.get(run_id)
            if organization is None:
                results.append(_skipped(run_id, "Autofix run not found"))
                continue
            with viewer_context_scope(
                ViewerContext(organization_id=organization.id, actor_type=ActorType.SYSTEM)
            ):
                results.append(_retry_run(organization, run_id))
        return Response({"results": results})


def _skipped(run_id: int, reason: str) -> dict[str, Any]:
    return {"run_id": run_id, "retried": False, "reason": reason}


def _retry_run(organization: Organization, run_id: int) -> dict[str, Any]:
    try:
        state = fetch_run_status(run_id, organization)
    except Exception:
        logger.exception(
            "autofix.admin_retry.fetch_state_failed",
            extra={"run_id": run_id, "organization_id": organization.id},
        )
        return _skipped(run_id, "Failed to fetch run state")

    if state.status != "error":
        return _skipped(run_id, f"Run status is {state.status!r}, not 'error'")

    step, step_referrer = AutofixOnCompletionHook._get_current_step(state)
    if step is None:
        return _skipped(run_id, "Could not determine the failed step")
    if step not in PIPELINE_ORDER:
        return _skipped(run_id, f"Retrying the {step} step is not supported")

    if state.get_created_pull_request_states() or state.coding_agents:
        return _skipped(run_id, "Run has a pull request or coding agent")

    group_id, run_referrer = AutofixOnCompletionHook._resolve_group_id(organization, run_id, state)
    if group_id is None:
        return _skipped(run_id, "Run has no group")
    group = AutofixOnCompletionHook._fetch_group(organization, run_id, group_id)
    if group is None:
        return _skipped(run_id, "Group not found")

    # Truncate from the failed step's first block so the retry replaces the
    # failed attempt rather than appending to it.
    insert_index = next(
        i
        for i, block in enumerate(state.blocks)
        if block.message.metadata and block.message.metadata.get("step") == step
    )

    try:
        trigger_autofix_agent(
            group=group,
            step=step,
            referrer=step_referrer or run_referrer or AutofixReferrer.UNKNOWN,
            run_id=run_id,
            insert_index=insert_index,
        )
    except Exception:
        logger.exception(
            "autofix.admin_retry.trigger_failed",
            extra={"run_id": run_id, "organization_id": organization.id, "step": step},
        )
        return _skipped(run_id, "Failed to trigger the step")

    logger.info(
        "autofix.admin_retry.triggered",
        extra={"run_id": run_id, "organization_id": organization.id, "step": step},
    )
    return {"run_id": run_id, "retried": True, "step": step}
