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
from sentry.seer.autofix.on_completion_hook import PIPELINE_ORDER, AutofixOnCompletionHook

logger = logging.getLogger(__name__)

MAX_RUN_IDS = 50


class AdminAutofixRetrySerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()
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

        organization_id = serializer.validated_data["organization_id"]
        try:
            organization = Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:
            return Response({"detail": "Organization not found"}, status=404)

        run_ids: list[int] = list(dict.fromkeys(serializer.validated_data["run_ids"]))
        results = [_retry_run(organization, run_id) for run_id in run_ids]
        return Response({"organization_id": organization.id, "results": results})


def _retry_run(organization: Organization, run_id: int) -> dict[str, Any]:
    def skipped(reason: str) -> dict[str, Any]:
        return {"run_id": run_id, "retried": False, "reason": reason}

    try:
        state = fetch_run_status(run_id, organization)
    except Exception:
        logger.exception(
            "autofix.admin_retry.fetch_state_failed",
            extra={"run_id": run_id, "organization_id": organization.id},
        )
        return skipped("Failed to fetch run state")

    if state.status != "error":
        return skipped(f"Run status is {state.status!r}, not 'error'")

    step, step_referrer = AutofixOnCompletionHook._get_current_step(state)
    if step is None:
        return skipped("Could not determine the failed step")
    if step not in PIPELINE_ORDER:
        return skipped(f"Retrying the {step} step is not supported")

    if state.get_created_pull_request_states() or state.coding_agents:
        return skipped("Run has a pull request or coding agent")

    group_id, run_referrer = AutofixOnCompletionHook._resolve_group_id(organization, run_id, state)
    if group_id is None:
        return skipped("Run has no group")
    group = AutofixOnCompletionHook._fetch_group(organization, run_id, group_id)
    if group is None:
        return skipped("Group not found")

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
        return skipped("Failed to trigger the step")

    logger.info(
        "autofix.admin_retry.triggered",
        extra={"run_id": run_id, "organization_id": organization.id, "step": step},
    )
    return {"run_id": run_id, "retried": True, "step": step}
